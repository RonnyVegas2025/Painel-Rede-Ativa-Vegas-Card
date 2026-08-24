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
select plan(5);

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

-- 5. O privilegio padrao do schema continua declarado --------------------------
-- Se alguem reverter a 0014, os testes 1 a 4 continuam verdes para as tabelas de
-- hoje e a proxima tabela nasce errada de novo. Esta assercao olha o padrao em
-- si, e nao o efeito dele.
--
-- Escopo: o papel `postgres`, que e quem cria as tabelas deste schema — as
-- migrations rodam como ele e ele e o dono das 7. Existe tambem uma entrada de
-- `supabase_admin` concedendo tudo a anon, inclusive TRUNCATE; ela e da
-- plataforma, vale so para tabela criada por aquele papel e nao esta sob controle
-- deste repositorio. Nao ficamos descobertos por causa dela: os testes 1 a 3
-- olham o privilegio efetivo de cada tabela existente, seja qual for o criador.
select is(
  (select count(*)::int
   from pg_default_acl d
   join pg_namespace n on n.oid = d.defaclnamespace
   where n.nspname = 'public'
     and d.defaclobjtype = 'r'
     and pg_get_userbyid(d.defaclrole) = 'postgres'
     and array_to_string(d.defaclacl, ' ') like '%anon=%'),
  0,
  'o privilegio padrao de public, para o papel criador das tabelas, nao concede nada a anon'
);

select * from finish();
rollback;
