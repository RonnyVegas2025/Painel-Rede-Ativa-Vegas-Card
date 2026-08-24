-- 0014 Privilegio padrao para tabelas futuras
--
-- PROBLEMA QUE ESTA MIGRATION CORRIGE
--
-- A 0011 concedeu privilegio tabela a tabela, nas 7 da Sprint 0. Isso conserta o
-- passado e nao conserta o futuro: a primeira tabela da Sprint 1 nasce com o
-- mesmo defeito, e nasce calada, exatamente como este nasceu.
--
-- Verificado com o banco no ar, criando uma tabela e olhando o que ela herda:
--
--   create table public.tabela_futura_sprint1 (id uuid primary key);
--
--   grantee        | privilegios
--   ---------------+-------------------------------
--   anon           | REFERENCES, TRIGGER, TRUNCATE
--   authenticated  | REFERENCES, TRIGGER, TRUNCATE
--   service_role   | REFERENCES, TRIGGER, TRUNCATE
--
-- Nenhum DML, e TRUNCATE para os tres — anon incluido. TRUNCATE ignora RLS: uma
-- tabela de historico da Sprint 1 nasceria apagavel por papel anonimo, e as
-- policies escritas para ela seriam codigo morto ate alguem lembrar do grant.
--
-- DECISAO
--
-- O privilegio padrao do schema passa a ser declarado aqui, em vez de herdado da
-- versao da imagem do Supabase. Foi a heranca que produziu o defeito original:
-- as imagens antigas concediam DML por default, as atuais nao, e a mesma
-- migration passou a significar coisas diferentes em maquinas diferentes.
--
-- Concede DML a authenticated e service_role, para que a RLS chegue a ser
-- avaliada. Nao e afrouxamento: a fronteira continua sendo a policy, que nega por
-- padrao. Tabela nova sem policy segue inacessivel — a diferenca e que agora ela
-- e negada pela RLS, que e onde a regra mora, e nao por falta de grant, que e
-- onde ninguem olha.
--
-- anon nao recebe nada, e perde o TRUNCATE herdado. Nenhuma tela do sistema abre
-- sem sessao.
--
-- O que isto NAO substitui: RLS continua sendo ligada explicitamente em cada
-- tabela, na migration que a cria. O teste 05_grants_and_rls.sql varre o schema
-- inteiro e falha se alguma tabela ficar sem RLS ou com TRUNCATE indevido, para
-- que a Sprint 1 nao consiga reintroduzir nenhum dos dois em silencio.

begin;

-- `for role postgres` explicito: privilegio padrao vale por papel criador, e as
-- migrations rodam como postgres, que e o dono das tabelas do schema. Sem isto a
-- clausula valeria para current_user, que e o mesmo hoje mas nao esta declarado.

-- Limpa o herdado (REFERENCES, TRIGGER, TRUNCATE) antes de declarar o que vale.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

commit;
