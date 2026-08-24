-- 0030 As RPCs da fila exigem usuario identificado, e dizem isso
--
-- As funcoes da 0029 gravam `reviewed_by = auth.uid()`. Sem JWT — service_role
-- sem usuario, chamada por psql, worker — `auth.uid()` devolve nulo, e a
-- constraint `segments_revisao_completa` recusa a linha com
-- "new row violates check constraint", que nao diz nada sobre a causa real.
--
-- Revisao e ato de alguem. Uma acao da fila sem autor identificado nao e um erro
-- de dados a ser reportado como constraint: e uma chamada que nao deveria existir.
-- Falhar com a frase certa poupa a proxima pessoa de procurar no lugar errado.

create or replace function public.assert_usuario_identificado()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception
      'Acao da fila de normalizacao exige usuario identificado: a revisao registra quem decidiu. Chamada sem sessao (service_role ou SQL direto) nao pode resolver item de fila.';
  end if;
  return v_uid;
end;
$$;

revoke execute on function public.assert_usuario_identificado() from public;
grant execute on function public.assert_usuario_identificado() to authenticated;

create or replace function public.resolve_segment_confirm(
  p_segment_id uuid,
  p_allow      uuid[] default '{}',
  p_deny       uuid[] default '{}'
)
returns void
language plpgsql
set search_path = ''
as $$
declare v_uid uuid := public.assert_usuario_identificado();
begin
  perform public.apply_segment_rules(p_segment_id, p_allow, p_deny);
  update public.segments
     set reviewed_at = now(), reviewed_by = v_uid
   where id = p_segment_id;
  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
end;
$$;

create or replace function public.resolve_segment_create(
  p_segment_id      uuid,
  p_normalized_name text,
  p_category        text,
  p_allow           uuid[] default '{}',
  p_deny            uuid[] default '{}'
)
returns void
language plpgsql
set search_path = ''
as $$
declare v_uid uuid := public.assert_usuario_identificado();
begin
  if coalesce(btrim(p_normalized_name), '') = '' then
    raise exception 'O nome de exibicao e obrigatorio';
  end if;
  -- source_name NAO muda, nunca: e o valor cru da planilha e a chave de
  -- reconciliacao. Mudar aqui faria a proxima importacao criar duplicata.
  update public.segments
     set normalized_name = btrim(p_normalized_name),
         category        = p_category,
         reviewed_at     = now(),
         reviewed_by     = v_uid
   where id = p_segment_id;
  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
  perform public.apply_segment_rules(p_segment_id, p_allow, p_deny);
end;
$$;

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
  v_uid     uuid := public.assert_usuario_identificado();
  v_produto uuid;
  v_regra   public.segment_rule_type;
begin
  if p_segment_id = p_canonical_id then
    raise exception 'Um segmento nao pode ser alias de si mesmo';
  end if;

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

  delete from public.product_segments
   where segment_id = p_segment_id
     and card_product_id = any(coalesce(p_migrate, '{}') || coalesce(p_discard, '{}'));

  -- Se sobrou regra, fn_block_alias_with_rules recusa aqui e a transacao inteira
  -- volta — inclusive as migracoes acima. E o ponto de a acao ser uma RPC.
  update public.segments
     set canonical_segment_id = p_canonical_id,
         reviewed_at          = now(),
         reviewed_by          = v_uid
   where id = p_segment_id;
  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
end;
$$;

create or replace function public.resolve_segment_deactivate(p_segment_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare v_uid uuid := public.assert_usuario_identificado();
begin
  -- Segmento inativo sai de TODAS as modalidades, nao so da que motivou a
  -- revisao. A tela confirma com a contagem antes de chegar aqui.
  update public.segments
     set is_active = false, reviewed_at = now(), reviewed_by = v_uid
   where id = p_segment_id;
  if not found then
    raise exception 'Segmento % nao encontrado ou sem permissao', p_segment_id;
  end if;
end;
$$;
