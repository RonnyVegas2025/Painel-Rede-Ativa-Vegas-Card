-- Invariantes de privilegio e RLS, varrendo o schema public INTEIRO.
--
-- Os testes de 01 a 04 nomeiam as tabelas da Sprint 0. Isso os torna cegos para
-- o que vier depois: foi assim que a ausencia de grant nas 7 tabelas atravessou a
-- revisao, e seria assim de novo na primeira tabela da Sprint 1.
--
-- Nenhuma assercao aqui cita nome de tabela. O que este arquivo verifica vale
-- para toda tabela que existir em public, hoje e depois.
--
-- Se uma migration futura criar tabela sem RLS, deixar TRUNCATE para anon ou
-- escrever policy sem o grant correspondente, isto falha no CI antes de a tela
-- ser construida em cima.

begin;
select plan(8);

-- 1. TRUNCATE ignora RLS -------------------------------------------------------
-- Um usuario logado com TRUNCATE esvazia audit_logs sem passar por policy
-- nenhuma, e audit_logs foi desenhada para nao aceitar escrita de papel algum.
-- O default do schema concedia TRUNCATE aos tres papeis; a 0011 revogou nas
-- tabelas existentes e a 0014 tirou do padrao. Isto impede a volta.
select is(
  (select count(*)::int
   from information_schema.role_table_grants
   where table_schema = 'public'
     and privilege_type = 'TRUNCATE'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'nenhuma tabela de public concede TRUNCATE a anon, authenticated ou service_role'
);

-- 2. anon nao alcanca dado -----------------------------------------------------
-- Nao ha policy para anon em lugar nenhum e nenhuma tela abre sem sessao.
-- Privilegio sem policy e superficie sem guarda: some antes de virar tentacao.
select is(
  (select count(*)::int
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  0,
  'anon nao tem privilegio algum em public'
);

-- 3. RLS ligada em toda tabela -------------------------------------------------
-- Com a 0014 concedendo DML por padrao, a policy passou a ser a unica fronteira.
-- Tabela sem RLS agora nao e apenas incompleta: e aberta a qualquer autenticado.
select is(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'toda tabela de public tem RLS habilitada'
);

-- 4. Nenhuma policy e codigo morto ---------------------------------------------
-- O defeito original em uma frase: havia 30 policies escritas e zero grants,
-- entao o PostgREST negava por 42501 e nenhuma delas chegava a ser avaliada. A
-- recusa por falta de privilegio se parece com recusa por politica, e foi isso
-- que deixou V7 e V8 verdes pelo motivo errado.
--
-- Para cada (tabela, comando) com policy para authenticated, o privilegio
-- correspondente precisa existir.
select is(
  (select count(*)::int
   from (
     select distinct p.tablename, p.cmd
     from pg_policies p
     where p.schemaname = 'public'
       and p.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
       and 'authenticated' = any (p.roles)
   ) pol
   where not exists (
     select 1
     from information_schema.role_table_grants g
     where g.table_schema = 'public'
       and g.table_name = pol.tablename
       and g.grantee = 'authenticated'
       and g.privilege_type = pol.cmd
   )),
  0,
  'toda policy de authenticated tem o grant correspondente: nenhuma e codigo morto'
);

-- 5 e 6. O privilegio padrao do schema continua declarado ----------------------
-- Se alguem reverter a 0014 ou a 0015, os testes 1 a 4 continuam verdes para as
-- tabelas de hoje e a proxima tabela nasce errada. Estas duas assercoes olham o
-- padrao em si, e nao o efeito dele.
--
-- O papel NAO e citado pelo nome. `alter default privileges` vale por papel
-- criador, e fixar 'postgres' aqui repetiria, no teste, o mesmo defeito que a
-- 0015 corrige na migration: se outro ambiente aplicar as migrations com outro
-- papel, um teste preso a 'postgres' passaria sem ter verificado aquele ambiente.
-- O papel e derivado de quem, de fato, e dono das tabelas deste schema.
--
-- `supabase_admin` fica de fora: e da plataforma, concede tudo a anon por padrao,
-- vale so para tabela criada por ele e nao esta sob controle deste repositorio.
-- Nao ficamos descobertos por causa disso — os testes 1 a 3 olham o privilegio
-- efetivo de cada tabela existente, seja qual for o criador.

select is(
  (select count(*)::int
   from (
     select distinct c.relowner as dono
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and pg_get_userbyid(c.relowner) <> 'supabase_admin'
   ) donos
   where (
     select count(distinct a.privilege_type)
     from pg_default_acl d
     join pg_namespace ns on ns.oid = d.defaclnamespace
     cross join lateral aclexplode(d.defaclacl) a
     where ns.nspname = 'public'
       and d.defaclobjtype = 'r'
       and d.defaclrole = donos.dono
       and a.grantee = 'authenticated'::regrole::oid
       and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
   ) <> 4),
  0,
  'todo papel dono de tabela em public concede os quatro DML a authenticated por padrao'
);

select is(
  (select count(*)::int
   from (
     select distinct c.relowner as dono
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and pg_get_userbyid(c.relowner) <> 'supabase_admin'
   ) donos
   where exists (
     select 1
     from pg_default_acl d
     join pg_namespace ns on ns.oid = d.defaclnamespace
     cross join lateral aclexplode(d.defaclacl) a
     where ns.nspname = 'public'
       and d.defaclobjtype = 'r'
       and d.defaclrole = donos.dono
       and a.grantee = 'anon'::regrole::oid
   )),
  0,
  'nenhum papel dono de tabela em public concede privilegio padrao a anon'
);

-- 7 e 8. Views tambem sao superficie -----------------------------------------
-- Os testes acima varrem `relkind = 'r'`: genericos quanto a QUAIS tabelas, e
-- cegos quanto a relacoes que nao sao tabelas. A primeira view do schema expos
-- isso, e o defeito foi real — `segment_normalization_queue` nasceu sem
-- `security_invoker`, ignorando a RLS, e com privilegio de escrita vindo do
-- padrao do schema. Um consultor conseguiu inserir em `segments` por ela.
--
-- Uma view sobre tabela com RLS precisa avaliar as policies de quem consulta, e
-- nao pode aceitar escrita: view auto-atualizavel e porta para contornar a policy
-- da tabela de baixo, e o privilegio padrao a concede sozinha em toda view nova.

select is(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'),
  0,
  'toda view de public tem security_invoker: avalia a RLS de quem consulta'
);

select is(
  (select count(*)::int
   from information_schema.role_table_grants g
   join pg_class c on c.relname = g.table_name
   join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where c.relkind = 'v'
     and g.table_schema = 'public'
     and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
     and g.grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'nenhuma view de public aceita escrita: seria porta para contornar a policy da tabela'
);

select * from finish();
rollback;
