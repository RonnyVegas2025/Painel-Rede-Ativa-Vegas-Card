begin;
select plan(14);

-- Enums e funcoes existem ------------------------------------------------------
select has_type('public', 'user_role', 'enum user_role existe');
select has_type('public', 'visit_status', 'enum visit_status existe');

-- 'disponivel' NAO pode existir: e a ausencia de visita ativa (ADR 0002).
select is(
  (select count(*)::int from pg_enum e
   join pg_type t on t.oid = e.enumtypid
   where t.typname = 'visit_status' and e.enumlabel = 'disponivel'),
  0,
  'visit_status nao contem disponivel'
);

select is(
  (select count(*)::int from pg_enum e
   join pg_type t on t.oid = e.enumtypid where t.typname = 'operational_status'),
  10,
  'operational_status tem os 10 valores da uniao aprovada'
);

-- Elegibilidade ----------------------------------------------------------------
select is(public.is_segment_eligible('all', null), true, 'all aceita sem regra');
select is(public.is_segment_eligible('all', 'deny'), true, 'all ignora deny');
select is(public.is_segment_eligible('allowlist', 'allow'), true, 'allowlist aceita allow');
select is(public.is_segment_eligible('allowlist', 'deny'), false, 'allowlist recusa deny');
select is(public.is_segment_eligible('allowlist', null), false,
  'allowlist falha fechada: sem regra e inelegivel');
select is(public.is_segment_eligible('denylist', null), true, 'denylist aceita sem regra');
select is(public.is_segment_eligible('denylist', 'deny'), false, 'denylist recusa deny');

-- Funcoes protegidas -----------------------------------------------------------
select function_privs_are('public', 'auth_role', array[]::text[], 'public', array[]::text[],
  'auth_role nao e executavel por public');
select function_privs_are('public', 'fn_audit', array[]::text[], 'public', array[]::text[],
  'fn_audit nao e executavel por public');

-- search_path fixado em toda SECURITY DEFINER -----------------------------------
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
     )),
  0,
  'toda funcao SECURITY DEFINER fixa search_path'
);

select * from finish();
rollback;
