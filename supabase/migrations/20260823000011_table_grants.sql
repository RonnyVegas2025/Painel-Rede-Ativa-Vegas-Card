-- 0011 Privilegios de tabela para os papeis do PostgREST
--
-- PROBLEMA QUE ESTA MIGRATION CORRIGE
--
-- As migrations 0001 a 0010 escrevem RLS em toda tabela operacional, mas nunca
-- concedem privilegio de tabela a anon, authenticated ou service_role. Ate a
-- Sprint 0 isso passou despercebido porque as imagens antigas do Supabase
-- concediam DML por `alter default privileges` no schema public.
--
-- As imagens atuais nao concedem mais. O default ACL efetivo passou a ser:
--
--   postgres | r | {anon=Dxt/postgres, authenticated=Dxt/postgres, service_role=Dxt/postgres}
--
-- ou seja TRUNCATE, REFERENCES e TRIGGER — e nenhum SELECT, INSERT ou UPDATE.
--
-- Consequencias observadas com o banco no ar:
--
--   1. Toda chamada ao PostgREST devolve `42501 permission denied for table X`,
--      para qualquer papel, inclusive gestor_master. A aplicacao inteira fica
--      inoperante pela API.
--   2. As policies da 0009 viram codigo morto: o GRANT nega antes de a RLS ser
--      avaliada, entao nada do que foi escrito la chega a ser exercitado.
--   3. Os testes de seguranca passam pelo motivo errado. Verificar que o
--      consultor NAO altera system_settings da verde quando ninguem altera
--      coisa alguma. Recusa por indisponibilidade se parece com recusa por
--      politica, e so o caminho real distingue as duas.
--   4. anon recebe TRUNCATE em todas as tabelas. TRUNCATE ignora RLS e apagaria
--      audit_logs, que o desenho inteiro trata como imutavel.
--
-- DECISAO
--
-- Privilegio de tabela passa a ser explicito neste repositorio, em vez de
-- herdado do ambiente. Herdar tornou o modelo de seguranca dependente da versao
-- da imagem: a mesma migration produz permissao diferente em maquinas
-- diferentes, e o sintoma aparece longe da causa.
--
-- O conjunto concedido espelha exatamente os comandos que tem policy na 0009.
-- Privilegio sem policy correspondente e superficie sem guarda; policy sem
-- privilegio correspondente e regra que nunca roda.

begin;

-- Limpa o Dxt herdado, TRUNCATE incluso, antes de conceder o que vale.
revoke all on all tables in schema public from anon, authenticated, service_role;

-- anon nao recebe nada: nao ha policy para anon na 0009, e toda tela exige
-- sessao. Fica registrado por ausencia deliberada, nao por esquecimento.

-- authenticated: um grant por comando com policy.
grant select                       on public.audit_logs       to authenticated;
grant select, insert, update       on public.card_products    to authenticated;
grant select, insert, update, delete on public.product_segments to authenticated;
grant select, update               on public.profiles         to authenticated;
grant select, insert, update       on public.segments         to authenticated;
grant select, update               on public.system_settings  to authenticated;
grant select, insert, update       on public.teams            to authenticated;

-- service_role ignora RLS e serve worker e importacao (src/lib/supabase/admin.ts).
-- Recebe o mesmo conjunto, e nao mais: em audit_logs continua so leitura, porque
-- log so se escreve pela trigger security definer. Sem DELETE em lugar nenhum —
-- importacao e sincronizacao, e registro ausente vai para analise, nunca some.
grant select                       on public.audit_logs       to service_role;
grant select, insert, update       on public.card_products    to service_role;
grant select, insert, update       on public.product_segments to service_role;
grant select, update               on public.profiles         to service_role;
grant select, insert, update       on public.segments         to service_role;
grant select, update               on public.system_settings  to service_role;
grant select, insert, update       on public.teams            to service_role;

-- audit_logs_id_seq nao entra: fn_audit e security definer e escreve como dona.
-- Conceder a sequence abriria escrita de log por fora da trigger.

commit;
