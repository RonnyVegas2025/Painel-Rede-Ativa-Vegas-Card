-- 0029 Resolucao da fila de normalizacao, em transacao
--
-- POR QUE RPC, E NAO CHAMADAS SOLTAS DA APLICACAO
--
-- Resolver um item da fila e mais de uma escrita, e as escritas nao sao
-- independentes:
--
--   mapear   = migrar ou descartar cada regra pendurada  +  gravar o alias
--              +  marcar revisado
--   criar    = renomear e classificar  +  gravar as modalidades  +  marcar revisado
--   confirmar= gravar as modalidades  +  marcar revisado
--   desativar= desativar  +  marcar revisado
--
-- Feitas em chamadas separadas pelo PostgREST, cada uma e sua propria transacao.
-- Meio caminho deixa estado incoerente e silencioso: regra migrada sem o alias
-- gravado tira a elegibilidade do segmento antigo sem dar a ninguem; alias
-- gravado sem revisao deixa o item na fila para ser resolvido de novo.
--
-- Aqui cada acao e uma transacao. Ou tudo, ou nada.
--
-- SECURITY INVOKER, DE PROPOSITO
--
-- Estas funcoes NAO sao security definer. Rodam com o papel de quem chama, entao
-- as policies de segments e product_segments continuam valendo — quem nao e
-- gestao esbarra na RLS, e nao numa checagem de papel escrita aqui, que seria uma
-- segunda copia da matriz livre para divergir.
--
-- A trigger fn_block_alias_with_rules continua ativa e e a rede final: se a
-- migracao das regras nao tiver acontecido, o alias e recusado mesmo por dentro
-- da RPC.

begin;

-- ---------------------------------------------------------------------------
-- Confirmar como esta, opcionalmente definindo as modalidades
-- ---------------------------------------------------------------------------
-- "Confirmar" e provavelmente a acao mais frequente: segmento que legitimamente
-- e o que e. Sem ela, o item voltaria a fila a cada abertura da tela.
--
-- p_allow / p_deny fecham o ciclo: resolver a fila sem dizer quais modalidades
-- aceitam o segmento nao torna nada elegivel, e a unica forma de criar regra
-- passaria a ser SQL direto.
create or replace function public.resolve_segment_confirm(
  p_segment_id uuid,
  p_allow      uuid[] default '{}',
  p_deny       uuid[] default '{}'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.apply_segment_rules(p_segment_id, p_allow, p_deny);

  update public.segments
     set reviewed_at = now(),
         reviewed_by = (select auth.uid())
   where id = p_segment_id;

  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Criar como segmento proprio: renomear, classificar e definir modalidades
-- ---------------------------------------------------------------------------
-- `source_name` NAO muda, nunca. E o valor cru da planilha e a chave de
-- reconciliacao: mudar aqui faria a proxima importacao criar uma duplicata e
-- reabrir o item na fila.
create or replace function public.resolve_segment_create(
  p_segment_id       uuid,
  p_normalized_name  text,
  p_category         text,
  p_allow            uuid[] default '{}',
  p_deny             uuid[] default '{}'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(btrim(p_normalized_name), '') = '' then
    raise exception 'O nome de exibicao e obrigatorio';
  end if;

  update public.segments
     set normalized_name = btrim(p_normalized_name),
         category        = p_category,
         reviewed_at     = now(),
         reviewed_by     = (select auth.uid())
   where id = p_segment_id;

  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;

  perform public.apply_segment_rules(p_segment_id, p_allow, p_deny);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mapear para um canonico, resolvendo as regras penduradas antes
-- ---------------------------------------------------------------------------
-- p_migrate: modalidades cuja regra vai para o canonico.
-- p_discard: modalidades cuja regra e descartada.
-- Toda regra pendurada tem de estar em uma das duas listas — o que sobrar faz a
-- trigger recusar o alias, e a transacao inteira volta.
create or replace function public.resolve_segment_map(
  p_segment_id   uuid,
  p_canonical_id uuid,
  p_migrate      uuid[] default '{}',
  p_discard      uuid[] default '{}'
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_produto uuid;
  v_regra   public.segment_rule_type;
begin
  if p_segment_id = p_canonical_id then
    raise exception 'Um segmento nao pode ser alias de si mesmo';
  end if;

  -- Migrar: a regra do alias passa a valer para o canonico. Se o canonico ja
  -- tiver regra para a mesma modalidade, `on conflict` a sobrescreve — e a
  -- aplicacao so pede migracao depois de a pessoa ter decidido qual prevalece
  -- (ver resolve-rule-migration.ts).
  foreach v_produto in array coalesce(p_migrate, '{}')
  loop
    select rule_type into v_regra
      from public.product_segments
     where segment_id = p_segment_id and card_product_id = v_produto;

    if v_regra is not null then
      insert into public.product_segments (card_product_id, segment_id, rule_type)
      values (v_produto, p_canonical_id, v_regra)
      on conflict (card_product_id, segment_id)
      do update set rule_type = excluded.rule_type;
    end if;
  end loop;

  -- Descartar e migrar terminam igual do lado do alias: a regra sai dele.
  delete from public.product_segments
   where segment_id = p_segment_id
     and card_product_id = any(
       coalesce(p_migrate, '{}') || coalesce(p_discard, '{}')
     );

  -- Se sobrou regra, a trigger recusa aqui e desfaz tudo acima.
  update public.segments
     set canonical_segment_id = p_canonical_id,
         reviewed_at          = now(),
         reviewed_by          = (select auth.uid())
   where id = p_segment_id;

  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Desativar
-- ---------------------------------------------------------------------------
-- Segmento inativo sai de TODAS as modalidades, nao so da que motivou a revisao.
-- A contagem de estabelecimentos afetados vem da fila e a tela confirma antes.
create or replace function public.resolve_segment_deactivate(p_segment_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.segments
     set is_active   = false,
         reviewed_at = now(),
         reviewed_by = (select auth.uid())
   where id = p_segment_id;

  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auxiliar: aplica o conjunto de modalidades de um segmento
-- ---------------------------------------------------------------------------
-- Fecha o ciclo do ADR 0003. Resolver a fila responde "que segmento e este";
-- isto responde "quais modalidades o aceitam", que e a pergunta que governa
-- product_segments e sem a qual nada fica elegivel.
create or replace function public.apply_segment_rules(
  p_segment_id uuid,
  p_allow      uuid[],
  p_deny       uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_produto uuid;
begin
  -- Modalidade fora das duas listas perde a regra: a tela envia o conjunto
  -- completo, entao ausencia significa "nao se aplica".
  delete from public.product_segments
   where segment_id = p_segment_id
     and card_product_id <> all(
       coalesce(p_allow, '{}') || coalesce(p_deny, '{}')
     );

  foreach v_produto in array coalesce(p_allow, '{}')
  loop
    insert into public.product_segments (card_product_id, segment_id, rule_type)
    values (v_produto, p_segment_id, 'allow')
    on conflict (card_product_id, segment_id) do update set rule_type = 'allow';
  end loop;

  foreach v_produto in array coalesce(p_deny, '{}')
  loop
    insert into public.product_segments (card_product_id, segment_id, rule_type)
    values (v_produto, p_segment_id, 'deny')
    on conflict (card_product_id, segment_id) do update set rule_type = 'deny';
  end loop;
end;
$$;

revoke execute on function public.apply_segment_rules(uuid, uuid[], uuid[]) from public;
revoke execute on function public.resolve_segment_confirm(uuid, uuid[], uuid[]) from public;
revoke execute on function public.resolve_segment_create(uuid, text, text, uuid[], uuid[]) from public;
revoke execute on function public.resolve_segment_map(uuid, uuid, uuid[], uuid[]) from public;
revoke execute on function public.resolve_segment_deactivate(uuid) from public;

grant execute on function public.apply_segment_rules(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_confirm(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_create(uuid, text, text, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_map(uuid, uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_deactivate(uuid) to authenticated;

commit;
