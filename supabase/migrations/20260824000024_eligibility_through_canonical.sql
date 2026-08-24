-- 0024 Elegibilidade resolvida pelo segmento canonico
--
-- Com alias (0023), um estabelecimento vinculado a `PADARIA E CONFEITARIA` precisa
-- ser elegivel para a modalidade que permite `Padaria`. A regra passa a ser
-- procurada no CANONICO, nao no segmento em que o estabelecimento esta pendurado.
--
-- DUAS MUDANCAS, E A SEGUNDA NAO ESTAVA PEDIDA
--
-- 1. A resolucao pelo canonico, que e o que foi pedido.
--
-- 2. A regra deixa de ler o banco.
--
--    `eligible_segments` consultava segments e product_segments por dentro. O
--    PLATFORM-STANDARDS.md §4 diz que regra de negocio nao le banco e recebe
--    parametros por argumento — "e o que a torna testavel sem infraestrutura". O
--    lado TypeScript sempre seguiu isso; o lado SQL nunca seguiu, e ninguem
--    notou porque nao havia com o que comparar.
--
--    Consequencia pratica: `eligible_segments` nao podia entrar no arnes de
--    paridade, porque o arnes compara funcoes puras com a mesma entrada, e uma
--    das duas lia tabela. A mudanca de regra mais consequente da Sprint 1 ficaria
--    fora justamente da verificacao que existe para proteger mudanca de regra.
--
--    Agora a decisao vive em `eligible_segment_ids`, pura, que recebe os
--    segmentos e as regras por argumento. `eligible_segments` vira o invólucro
--    que le e delega — e e o invólucro, nao a regra, que conhece o banco.
--
-- REGRA DE RESOLUCAO, EM UMA FRASE
--
-- Um segmento e elegivel quando ele esta ativo, seu canonico esta ativo, e a
-- regra mapeada AO CANONICO passa em is_segment_eligible para o modo do produto.
--
-- Consequencia deliberada: regra mapeada a um segmento que depois virou alias
-- deixa de governar — quem governa e o canonico. E o proposito do alias, e a tela
-- avisa antes de aplicar.

begin;

-- ---------------------------------------------------------------------------
-- A regra, pura. Nao le tabela nenhuma.
-- ---------------------------------------------------------------------------
-- p_segments: [{"id": uuid, "is_active": bool, "canonical_segment_id": uuid|null}]
-- p_rules:    [{"segment_id": uuid, "rule_type": "allow"|"deny"}]
--
-- Devolve os ids ORDENADOS. Ordem estavel e o que torna o resultado comparavel
-- com a gemea TypeScript pelo arnes.
create or replace function public.eligible_segment_ids(
  p_mode     public.eligibility_mode,
  p_segments jsonb,
  p_rules    jsonb
)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  with seg as (
    select
      (s ->> 'id')::uuid                                  as id,
      coalesce((s ->> 'is_active')::boolean, true)         as is_active,
      nullif(s ->> 'canonical_segment_id', '')::uuid       as canonical_id
    from jsonb_array_elements(coalesce(p_segments, '[]'::jsonb)) as s
  ),
  regra as (
    select
      (r ->> 'segment_id')::uuid                           as segment_id,
      (r ->> 'rule_type')::public.segment_rule_type        as rule_type
    from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) as r
  ),
  resolvido as (
    select
      seg.id,
      seg.is_active,
      coalesce(seg.canonical_id, seg.id) as canonico_id
    from seg
  )
  select coalesce(array_agg(resolvido.id order by resolvido.id), '{}'::uuid[])
  from resolvido
  -- O canonico precisa existir na lista e estar ativo. Alias cujo canonico saiu
  -- de circulacao nao volta a ser elegivel por conta propria.
  join resolvido as canonico
    on canonico.id = resolvido.canonico_id
  left join regra on regra.segment_id = resolvido.canonico_id
  where resolvido.is_active
    and canonico.is_active
    and public.is_segment_eligible(p_mode, regra.rule_type);
$$;

comment on function public.eligible_segment_ids is
  'Regra pura de elegibilidade, resolvida pelo segmento canonico. Nao le banco:
   recebe segmentos e regras por argumento, conforme PLATFORM-STANDARDS.md §4.
   Gemea de eligibleSegmentIds em src/lib/business-rules/check-product-eligibility.ts,
   comparada pelo arnes do ADR 0010. Devolve ids ordenados.';

-- ---------------------------------------------------------------------------
-- O involucro: le o banco e delega. Assinatura preservada.
-- ---------------------------------------------------------------------------
create or replace function public.eligible_segments(p_card_product_id uuid)
returns table (segment_id uuid)
language sql
stable
set search_path = ''
as $$
  select unnest(
    public.eligible_segment_ids(
      (select cp.eligibility_mode from public.card_products cp where cp.id = p_card_product_id),
      (select coalesce(jsonb_agg(jsonb_build_object(
                'id', s.id,
                'is_active', s.is_active,
                'canonical_segment_id', s.canonical_segment_id)), '[]'::jsonb)
         from public.segments s),
      (select coalesce(jsonb_agg(jsonb_build_object(
                'segment_id', ps.segment_id,
                'rule_type', ps.rule_type)), '[]'::jsonb)
         from public.product_segments ps
        where ps.card_product_id = p_card_product_id)
    )
  );
$$;

comment on function public.eligible_segments is
  'Segmentos elegiveis para a modalidade. Le o banco e delega a decisao a
   eligible_segment_ids, que e pura — o involucro conhece o banco, a regra nao.';

revoke execute on function public.eligible_segment_ids(public.eligibility_mode, jsonb, jsonb) from public;
grant  execute on function public.eligible_segment_ids(public.eligibility_mode, jsonb, jsonb) to authenticated, service_role;

commit;
