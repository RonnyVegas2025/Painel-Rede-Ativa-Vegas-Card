-- 0012 is_segment_eligible: falha fechada de verdade
--
-- A 0008 declara a intencao no proprio comentario da funcao:
--
--   when 'allowlist' then p_rule = 'allow'   -- nulo => falso: falha fechada
--
-- Mas `p_rule = 'allow'` com p_rule nulo devolve NULL, nao false. Logica de tres
-- valores: o comentario descreve o que se queria, o operador entrega outra coisa.
--
-- Encontrado pelo pgTAP 01_helpers_and_enums.sql, teste 9:
--   is(public.is_segment_eligible('allowlist', null), false)
--   have: NULL   want: false
--
-- Por que passou despercebido: o unico consumidor hoje e eligible_segments, que
-- chama a funcao dentro de um WHERE — e ali NULL descarta a linha, igual a false.
-- O criterio de aceite numero um (Farmacia nao exibe posto) portanto passa, mas
-- passa pelo contexto da chamada, nao pela funcao. Basta o primeiro
-- `if not public.is_segment_eligible(...)` ou um `!elegivel` do lado TypeScript
-- para a falha fechada virar falha aberta, que e exatamente o que o ADR 0003
-- proibe: segmento nao mapeado nunca e elegivel em modo allowlist.
--
-- A linha do denylist logo abaixo ja usava o operador certo. Esta migration
-- alinha a do allowlist e passa a devolver booleano em qualquer entrada.

create or replace function public.is_segment_eligible(
  p_mode public.eligibility_mode,
  p_rule public.segment_rule_type
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_mode
    when 'all'       then true
    -- `is not distinct from` devolve false com nulo, onde `=` devolveria nulo.
    when 'allowlist' then p_rule is not distinct from 'allow'
    when 'denylist'  then p_rule is distinct from 'deny'
  end;
$$;

comment on function public.is_segment_eligible is
  'Elegibilidade de um segmento sob o modo da modalidade. Falha fechada: em
   allowlist, ausencia de regra e inelegivel (ADR 0003). Nunca devolve nulo para
   modo conhecido.';

revoke execute on function public.is_segment_eligible(public.eligibility_mode, public.segment_rule_type) from public;
grant execute on function public.is_segment_eligible(public.eligibility_mode, public.segment_rule_type) to authenticated, service_role;
