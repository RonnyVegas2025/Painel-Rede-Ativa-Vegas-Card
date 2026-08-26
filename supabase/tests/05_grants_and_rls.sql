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
--
-- ESTE ARQUIVO E PECA ESTRUTURAL, NAO VERIFICACAO DE CONVENIENCIA.
--
-- `alter default privileges ... on tables` cobre tabelas E views no PostgreSQL:
-- nao ha como conceder DML por padrao a tabela sem conceder a view. Ou seja, toda
-- view nova do schema nasce com privilegio de escrita, e a unica coisa entre isso
-- e uma escalada de privilegio sao as assercoes 7 e 8 abaixo.
--
-- Ja aconteceu: `segment_normalization_queue` nasceu assim, e um consultor_campo
-- inseriu em `public.segments` por um POST na view, contornando a policy que
-- exige is_admin(). Enfraquecer esta varredura reabre aquilo. Ver ADR 0012.

begin;
select plan(13);

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
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0,
  'toda tabela de public tem RLS habilitada, particionada inclusive'
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

-- 9, 10 e 11. Os outros tipos de relacao ---------------------------------------
-- Estender de 'r' para incluir 'v' fechou a view, e deixou tres pontos cegos. O
-- tratamento correto nao e o mesmo para os tres.

-- View materializada NAO SUPORTA RLS, de forma nenhuma: `security_invoker` nao se
-- aplica. Matview sobre tabela protegida e vazamento por construcao, nao por
-- descuido. Quem precisar de uma abre excecao explicita, com revisao.
select is(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'm'),
  0,
  'nenhuma view materializada em public: matview nao suporta RLS'
);

-- Tabela estrangeira nao tem razao para existir aqui. Se aparecer, e sinal de
-- integracao montada fora do desenho.
select is(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'f'),
  0,
  'nenhuma tabela estrangeira em public'
);

-- Tabela particionada: verificar como tabela. A RLS se declara no PAI, e uma
-- varredura que so olha 'r' verifica as particoes e ignora o pai — que e onde a
-- politica vive. Chega na Sprint 8: transaction_hourly_metrics e particionada por
-- mes no desenho.
select is(
  (select count(*)::int
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'p' and not c.relrowsecurity),
  0,
  'toda tabela particionada de public tem RLS habilitada no pai'
);

-- 12 e 13. INVENTARIO DAS FUNCOES `SECURITY DEFINER` --------------------------
--
-- POR QUE ISTO EXISTE
--
-- `import_commit` verificava apenas "esta logado?" e era `security definer`: a
-- RLS nao e avaliada dentro dela, entao o `grant execute to authenticated` era o
-- unico controle real. Um `consultor_campo` aplicava uma importacao inteira.
--
-- O `is_admin()` que corrigiu aquela funcao NAO e a correcao duravel. A varredura
-- e. `import_commit` era a unica com o furo naquele dia; a proxima funcao definer
-- com execute para `authenticated` nasce com o mesmo, e ninguem vai lembrar de
-- varrer de novo. Foi exatamente assim com o GRANT das tabelas e com a view sem
-- `security_invoker`.
--
-- Mesma forma da amarracao de tipos ao schema e da guarda de navegacao: a
-- verificacao falha quando alguem INTRODUZ o problema, nao quando alguem lembra
-- de procurar.
--
-- COMO MANTER
--
-- Funcao definer nova quebra a assercao 12. Quem a adicionar escolhe uma lista e
-- escreve o motivo. Nao ha terceira opcao, e e de proposito.

-- 12. Nenhuma funcao definer fora das duas listas revisadas.
select set_eq(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and has_function_privilege('authenticated', p.oid, 'execute') $$,
  $$ values
       -- ESCREVEM NO DOMINIO — exigem papel na entrada.
       ('import_commit(uuid)'),

       -- NAO exigem papel, e o motivo de cada uma:
       -- devolvem o papel/equipe/IP DO PROPRIO chamador; nao ha o que escalar.
       ('auth_role()'),
       ('auth_team_id()'),
       ('request_ip()'),
       -- sao a propria checagem de papel; exigir papel para checar papel e ciclo.
       ('is_admin()'),
       ('has_role(user_role[])'),
       -- funcoes de trigger: retornam `trigger`, e o Postgres recusa chamada
       -- direta ("trigger functions can only be called as triggers"). O grant e
       -- heranca do padrao do schema, nao superficie.
       --
       -- `fn_audit` e `fn_handle_new_user` foram acrescentadas depois: elas NAO
       -- apareciam no banco de desenvolvimento, que tinha passado por dezenas de
       -- `db reset` sobre o mesmo volume. Num ENSAIO DE INSTALACAO LIMPA — volumes
       -- destruidos, 46 migrations em sequencia — apareceram.
       --
       -- O inventario tinha sido montado a partir de um banco que acumulou estado,
       -- e por isso descrevia aquele banco em vez do schema. E a mesma classe das
       -- fixtures que passavam por dado que ja estava la, um nivel acima: a
       -- verificacao lia o ambiente, nao o codigo.
       ('fn_block_alias_with_rules()'),
       ('fn_protect_profile_fields()'),
       ('fn_audit()'),
       ('fn_handle_new_user()')
  $$,
  'toda funcao SECURITY DEFINER executavel por authenticated esta na lista revisada'
);

-- 13. As que escrevem no dominio checam papel de fato.
--
-- Assercao grosseira de proposito: procura a chamada no corpo. Nao prova que a
-- checagem esta no lugar certo — prova que ela existe, e teria pego o furo do
-- import_commit no dia em que ele nasceu.
--
-- OS COMENTARIOS SAO REMOVIDOS ANTES DE PROCURAR, e isso nao e detalhe.
--
-- `pg_get_functiondef` devolve o corpo COM os comentarios. A primeira versao
-- desta assercao passou com a checagem desativada, porque o bloco de comentario
-- dentro de import_commit explica por que `is_admin()` esta ali — e a palavra
-- bastava para o casamento. A verificacao respondia "alguem escreveu is_admin
-- em algum lugar", nao "a funcao chama is_admin".
--
-- Descoberto injetando o defeito, que e a unica forma de descobrir isto.
select is(
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.oid::regprocedure::text in ('import_commit(uuid)')
      and regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
          !~ 'public\.(is_admin|has_role)\s*\('),
  null,
  'funcao definer que escreve no dominio chama is_admin() ou has_role() no codigo'
);

select * from finish();
rollback;
