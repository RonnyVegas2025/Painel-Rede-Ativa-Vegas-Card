-- 0015 Privilegio padrao independente do papel que aplica as migrations
--
-- PROBLEMA QUE ESTA MIGRATION CORRIGE
--
-- A 0014 escreveu `alter default privileges for role postgres`. Privilegio
-- padrao vale **por papel criador**: a clausula so tem efeito sobre tabelas
-- criadas por aquele papel especifico.
--
-- Local, as migrations rodam como `postgres` — medido, gravando current_user
-- numa tabela durante um `supabase db reset`:
--
--   current_user | session_user | superusuario
--   -------------+--------------+-------------
--   postgres     | postgres     | f
--
-- Se em algum ambiente o `supabase db push` aplicar as migrations com outro
-- papel, a clausula da 0014 nao alcanca as tabelas criadas la. O padrao volta a
-- ser o herdado da imagem — REFERENCES, TRIGGER e TRUNCATE, sem DML — e o
-- defeito do GRANT reaparece **so em producao**, calado, exatamente na forma que
-- custou a Sprint 0.
--
-- Nao da para verificar o ambiente hospedado a partir daqui, e a suposicao "deve
-- ser postgres la tambem" e o tipo de premissa que este projeto ja pagou caro
-- para descobrir errada. Entao a migration deixa de depender de saber a resposta.
--
-- DECISAO
--
-- A clausula passa a ser emitida para `current_user`, seja ele qual for. Quem
-- aplica as migrations e quem vai criar as tabelas das proximas sprints, entao e
-- exatamente o papel cujo padrao precisa estar certo.
--
-- Idempotente e inofensiva onde a 0014 ja acertou: local, current_user e
-- postgres, e esta migration reescreve a mesma entrada.
--
-- A rede de seguranca continua sendo 05_grants_and_rls.sql, que olha o
-- privilegio efetivo de cada tabela existente e o padrao do papel dono delas,
-- sem citar nome de papel nem de tabela. Se algum ambiente ainda escapar, ele
-- falha no CI daquele ambiente em vez de silenciar.

begin;

do $$
declare
  v_papel text := current_user;
begin
  -- `alter default privileges` nao aceita parametro: precisa de SQL dinamico, e
  -- o nome do papel entra por quote_ident.
  execute format(
    'alter default privileges for role %I in schema public '
    'revoke all on tables from anon, authenticated, service_role',
    v_papel
  );

  execute format(
    'alter default privileges for role %I in schema public '
    'grant select, insert, update, delete on tables to authenticated, service_role',
    v_papel
  );

  raise notice 'privilegio padrao de public declarado para o papel %', v_papel;
end $$;

commit;
