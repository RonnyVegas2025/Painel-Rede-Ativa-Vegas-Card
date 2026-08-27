-- 0047 Privilegio de FUNCAO passa a ser declarado, como o de tabela ja e
--
-- ===========================================================================
-- O MECANISMO, QUE EU TINHA DIAGNOSTICADO ERRADO
-- ===========================================================================
-- O ensaio de instalacao limpa acusou `fn_audit` e `fn_handle_new_user` fora do
-- inventario de `SECURITY DEFINER`. Atribui isso a "banco de desenvolvimento com
-- estado acumulado" — explicacao que nao fecha: as duas nascem nas migrations 0003
-- e 0004, e todo banco que rodou as migrations as tem.
--
-- O que muda entre um banco e outro nao e a EXISTENCIA delas, e o `execute`. E ele
-- vem de um lugar concreto:
--
--   pg_default_acl, papel postgres, schema public, tipo `f`:
--     postgres=X | anon=X | authenticated=X | service_role=X
--
-- A imagem do Supabase declara privilegio PADRAO DE FUNCOES em `public` para os
-- tres papeis. Toda funcao criada ali nasce executavel por `anon`.
--
-- E o `revoke execute ... from public` que eu escrevi em cada RPC NAO removia isso:
-- ele tira a entrada de PUBLIC, e as concessoes a `anon`, `authenticated` e
-- `service_role` sao ENTRADAS PROPRIAS. Media 37 funcoes de `public` executaveis
-- por `anon` — `import_commit` e `resolve_absences` entre elas.
--
-- Nao havia escalada: as duas exigem papel, e `anon` nao tem nenhum. Mas e
-- exatamente o que a assercao 2 da varredura ja dizia sobre tabelas —
-- "privilegio sem policy e superficie sem guarda: some antes de virar tentacao" —
-- e ela nunca olhou para funcoes.
--
-- E a terceira vez que este projeto encontra a mesma coisa: privilegio HERDADO do
-- ambiente em vez de DECLARADO (ADR 0012, migrations 0011 e 0014/0015, para
-- tabelas). Agora para funcoes.
--
-- ===========================================================================
-- A CORRECAO
-- ===========================================================================
-- 1. O padrao passa a nao conceder nada. Funcao nova nasce sem `execute`, e quem
--    a cria decide — como ja acontece com tabelas desde a 0014.
-- 2. Revogacao do que ja foi concedido em massa.
-- 3. Concessao explicita, uma a uma, com o motivo por grupo.
--
-- As funcoes de TRIGGER nao recebem nada: elas retornam `trigger`, e o Postgres
-- recusa chamada direta ("trigger functions can only be called as triggers"). O
-- `execute` nelas nunca serviu para nada — e cataloga-lo no inventario como
-- "inofensivo" seria pior que revogar: uma lista cuja justificativa e a ausencia
-- de dano deixa de significar algo depois de duas ou tres entradas assim.

begin;

-- ---------------------------------------------------------------------------
-- 1. O padrao
-- ---------------------------------------------------------------------------
do $$
declare v_papel text := current_user;
begin
  -- Como na 0015: `alter default privileges` vale por papel CRIADOR, e o nome
  -- entra por `quote_ident`. `for role postgres` fixo quebraria se as migrations
  -- rodassem sob outro papel.
  execute format(
    'alter default privileges for role %I in schema public '
    'revoke execute on functions from anon, authenticated, service_role',
    v_papel);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Revogar o que ja foi concedido
-- ---------------------------------------------------------------------------
do $$
declare v_f record;
begin
  for v_f in
    select p.oid::regprocedure::text as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated, service_role',
      v_f.assinatura);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Conceder o que precisa ser chamavel, com o motivo
-- ---------------------------------------------------------------------------

-- (a) Chamadas pela aplicacao como RPC.
grant execute on function public.import_commit(uuid) to authenticated;
grant execute on function public.import_create_preview(text, text) to authenticated;
grant execute on function public.import_finalize_preview(uuid, integer, integer, integer) to authenticated;
grant execute on function public.import_discard(uuid, text) to authenticated;
grant execute on function public.import_redeclare_scope(uuid, text, text) to authenticated;
grant execute on function public.import_finish_redeclaration(uuid) to authenticated;
grant execute on function public.import_cities(uuid) to authenticated;
grant execute on function public.import_absent_summary(uuid) to authenticated;
grant execute on function public.import_absent_establishments(uuid) to authenticated;
grant execute on function public.resolve_absences(uuid[], public.absence_resolution, text, integer) to authenticated;
grant execute on function public.resolve_segment_confirm(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_create(uuid, text, text, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_map(uuid, uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_segment_deactivate(uuid) to authenticated;
grant execute on function public.eligible_segments(uuid) to authenticated;
grant execute on function public.segment_alias_blockers(uuid) to authenticated;

-- (b) Avaliadas DENTRO de policy de RLS. A policy roda com o papel de quem
-- consulta, entao sem `execute` aqui toda leitura protegida falha.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.auth_role() to authenticated;
-- `anon` NAO recebe. A primeira versao concedia, com o raciocinio de que a policy
-- avalia antes de o papel existir. Medido: zero policies valem para `anon`, e as
-- cinco que chamam `auth_role` sao `to authenticated`. Fluxo completo com a
-- concessao removida — login, importacao, fila de segmentos, listagem — nao muda
-- em nada. `anon` fica sem funcao alguma em `public`.
--
-- Uma lista com uma excecao justificada por hipotese vira uma lista com tres.
grant execute on function public.auth_team_id() to authenticated;

-- (c) Avaliadas em COLUNA GERADA e em `check` de constraint. A expressao roda com
-- o privilegio de quem escreve a linha: sem `execute`, o insert do importador
-- falha em permissao, nao em regra.
grant execute on function public.normalize_address(text, text) to authenticated;
grant execute on function public.address_hash_input(text, text, text) to authenticated;

-- (d) Chamadas pela aplicacao para exibir rotulo e classificar em tela.
grant execute on function public.calculate_transaction_status(timestamptz, integer, integer, integer) to authenticated;
grant execute on function public.is_segment_eligible(public.eligibility_mode, public.segment_rule_type) to authenticated;
grant execute on function public.eligible_segment_ids(public.eligibility_mode, jsonb, jsonb) to authenticated;

-- (e) Auxiliares chamadas DE DENTRO de funcoes `security invoker`.
--
-- Funcao `invoker` roda com o papel de quem chamou, e o que ela chama por dentro
-- tambem. Sem estas duas, `resolve_segment_*` falha com
-- "permission denied for function assert_usuario_identificado" — que e erro de
-- PRIVILEGIO se passando por erro de regra.
--
-- Descoberto no ensaio, nao na revisao: a fila de segmentos parou de 15 para 15.
-- O pgTAP nao pegou porque 08_segment_queue_rpc.sql rodava como superusuario, e
-- superusuario nao esbarra em privilegio nenhum — a mesma classe de teste que le o
-- ambiente em vez do codigo. O arquivo passou a assumir o papel.
grant execute on function public.assert_usuario_identificado() to authenticated;
grant execute on function public.apply_segment_rules(uuid, uuid[], uuid[]) to authenticated;

-- (f) `custom_access_token_hook` e chamada pelo GoTrue, com papel proprio.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- `service_role` mantem o que a aplicacao de servidor precisa. Nao ha worker
-- ainda; quando houver, a concessao entra aqui, nomeada.

commit;

-- NAO recebem `execute` de ninguem, e nao e omissao:
--
--   funcoes de trigger — o Postgres recusa chamada direta:
--     fn_audit, fn_handle_new_user, fn_touch_updated_at, fn_validate_setting,
--     fn_check_recency_order, fn_protect_profile_fields, fn_block_alias_with_rules,
--     fn_import_rows_imutavel, fn_absence_resolutions_imutavel
--
--   auxiliares chamadas apenas de dentro de outras funcoes:
--     assert_usuario_identificado, apply_segment_rules, request_ip
