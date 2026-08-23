begin;
select plan(9);

-- RLS habilitada em todas as tabelas operacionais -------------------------------
select is(
  (select count(*)::int from pg_tables t
   where t.schemaname = 'public'
     and t.tablename in ('profiles','teams','card_products','segments',
                         'product_segments','system_settings','audit_logs')
     and not exists (
       select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
     )),
  0,
  'RLS habilitada nas 7 tabelas da Sprint 0'
);

-- FOR ALL e proibido: obriga a pensar em delete ---------------------------------
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and cmd = 'ALL'),
  0,
  'nenhuma policy usa FOR ALL'
);

-- audit_logs: sem escrita para ninguem ------------------------------------------
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'audit_logs'
     and cmd in ('INSERT','UPDATE','DELETE')),
  0,
  'audit_logs nao tem policy de escrita'
);
select isnt_empty(
  $$ select 1 from pg_policies where tablename = 'audit_logs' and cmd = 'SELECT' $$,
  'audit_logs tem leitura restrita'
);

-- profiles: sem insert (vem do trigger) e sem delete (orfanaria auditoria) -------
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='profiles' and cmd='DELETE'),
  0, 'profiles nao tem policy de delete');

-- system_settings: conjunto definido por migration ------------------------------
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='system_settings' and cmd in ('INSERT','DELETE')),
  0, 'system_settings nao aceita insert nem delete');

-- Catalogo com escrita restrita a gestao ----------------------------------------
select isnt_empty(
  $$ select 1 from pg_policies where tablename='card_products' and cmd='UPDATE' $$,
  'card_products tem policy de update');
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='card_products' and cmd='DELETE'),
  0, 'card_products nao aceita delete: desativa-se com is_active');

-- product_segments e a unica com delete: revogar regra e operacao do dia a dia ---
select isnt_empty(
  $$ select 1 from pg_policies where tablename='product_segments' and cmd='DELETE' $$,
  'product_segments aceita delete, e o unico caso');

select * from finish();
rollback;
