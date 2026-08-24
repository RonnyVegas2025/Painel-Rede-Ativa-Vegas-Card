-- 0026 Aliasar segmento com regra pendurada nao pode passar calado
--
-- O PROBLEMA, QUE E PIOR QUE O ORIGINAL
--
-- A regra de resolucao da 0024 diz: quem governa e o canonico. A consequencia
-- operacional nao estava dita.
--
-- Um segmento com `rule_type = 'allow'` para Farmacia, aliasado para outro,
-- **mantem a regra na tabela** — visivel na tela de modalidades, listada em
-- product_segments — e **para de valer**. Nada indica isso em lugar nenhum.
--
-- E pior que a falha fechada que motivou a fila: ali o segmento sumia das
-- modalidades restritas e aparecia na fila de normalizacao, entao havia onde
-- olhar. Aqui a regra fica visivel e inerte, e a unica pista seria alguem reparar
-- que um estabelecimento sumiu de uma modalidade sem que a regra dele mudasse.
--
-- DECISAO: RECUSAR, EM VEZ DE AVISAR
--
-- O banco recusa transformar em alias um segmento que tenha regra em
-- product_segments. Quem quiser aliasar resolve as regras antes — migrando ao
-- canonico ou descartando, com a escolha registrada em auditoria pelo trigger de
-- product_segments.
--
-- Recusar e mais forte que avisar na tela: aviso vale para quem passa pela tela,
-- e este caminho tambem existe por SQL direto, por importacao e por qualquer
-- servico futuro. A regra fica onde nao da para contornar.
--
-- O custo e uma etapa a mais na interface, e ela e honesta: a tela lista as regras
-- que bloqueiam, diz o que cada uma faz hoje, e oferece migrar ou descartar antes
-- de habilitar o botao de mapear.

create or replace function public.fn_block_alias_with_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regras integer;
  v_modalidades text;
begin
  -- So interessa a transicao para alias. Alias que continua alias, ou segmento
  -- que deixa de ser alias, nao mexem em regra nenhuma.
  if new.canonical_segment_id is null
     or new.canonical_segment_id is not distinct from old.canonical_segment_id then
    return new;
  end if;

  select count(*), string_agg(cp.name, ', ' order by cp.name)
    into v_regras, v_modalidades
  from public.product_segments ps
  join public.card_products cp on cp.id = ps.card_product_id
  where ps.segment_id = new.id;

  if v_regras > 0 then
    raise exception
      'Segmento tem % regra(s) de elegibilidade em: %. Migre ou descarte antes de mapear: com o alias, quem governa passa a ser o canonico e estas regras ficariam visiveis e sem efeito.',
      v_regras, v_modalidades;
  end if;

  return new;
end;
$$;

comment on function public.fn_block_alias_with_rules is
  'Impede transformar em alias um segmento com regra em product_segments. Sem
   isto a regra continuaria visivel na tela de modalidades e deixaria de valer,
   sem nada indicar — pior que a falha fechada que a fila de normalizacao existe
   para tratar, porque ali ao menos ha onde olhar.';

create trigger segments_bloqueia_alias_com_regra
  before update on public.segments
  for each row execute function public.fn_block_alias_with_rules();

-- ---------------------------------------------------------------------------
-- O que a tela precisa mostrar antes de habilitar o botao
-- ---------------------------------------------------------------------------
-- Nao basta dizer "existem regras": a decisao depende de saber QUAIS modalidades
-- e QUANTOS estabelecimentos mudam de modalidade — nao so de segmento.
create or replace function public.segment_alias_blockers(p_segment_id uuid)
returns table (
  card_product_id       uuid,
  card_product_name     text,
  rule_type             public.segment_rule_type,
  establishments_afetados bigint
)
language sql
stable
set search_path = ''
as $$
  select
    cp.id,
    cp.name,
    ps.rule_type,
    (select count(*) from public.establishments e
      where e.segment_id = p_segment_id and e.is_active)
  from public.product_segments ps
  join public.card_products cp on cp.id = ps.card_product_id
  where ps.segment_id = p_segment_id
  order by cp.name;
$$;

comment on function public.segment_alias_blockers is
  'Regras que impedem aliasar o segmento, com a modalidade e quantos
   estabelecimentos mudam de modalidade se elas forem descartadas. A tela lista
   isto antes de habilitar o mapeamento — a operacao nao pode passar calada.';

revoke execute on function public.segment_alias_blockers(uuid) from public;
grant execute on function public.segment_alias_blockers(uuid) to authenticated, service_role;
