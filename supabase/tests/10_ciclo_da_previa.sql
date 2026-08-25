-- O ciclo da previa: criar, montar, finalizar, descartar.
--
-- O que estas assercoes protegem, e que nenhuma outra protege:
--
-- 1. A INJECAO ENTRE A REVISAO E O COMMIT. A policy de INSERT permitia gestao
--    escrever em import_rows sem dizer EM QUAL JOB. Entre o operador revisar as
--    contagens e clicar em confirmar, outro usuario de gestao podia injetar
--    linhas naquele job — e o commit aplica o que esta em import_rows. Nao e
--    escalada de privilegio: quem insere ali ja podia escrever no dominio. E
--    integridade da revisao — o operador aprova um numero e recebe outro.
--
-- 2. O LOTE PARCIAL QUE PARECE COMPLETO. Queda na linha 900 de 1.804 deixaria a
--    previa com contagens plausiveis, e o commit aplicaria metade.
--
-- 3. O JOB TRAVADO SEM SAIDA. `processando` precisa ser descartavel, senao alguem
--    resolve por SQL direto.
--
-- Fixtures a prova de colisao: `.invalid` e `TESTE `.

begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('aaaa1111-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-a@pgtap.invalid', '{"full_name":"Admin A"}'::jsonb),
  ('aaaa1111-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-b@pgtap.invalid', '{"full_name":"Admin B"}'::jsonb),
  ('aaaa1111-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'consultor-c@pgtap.invalid', '{"full_name":"Consultor C"}'::jsonb);

-- As policies so sao avaliadas para papel nao-superusuario.
set local role authenticated;

-- ===========================================================================
-- Criar
-- ===========================================================================
select set_config('request.jwt.claims',
  '{"sub":"aaaa1111-0000-4000-8000-000000000003","user_role":"consultor_campo"}', true);

select throws_ok(
  $$ select public.import_create_preview('base.xlsx', 'TESTE Cidade') $$,
  '42501', null,
  'consultor de campo nao cria previa: a RLS recusa e a funcao traduz'
);

select set_config('request.jwt.claims',
  '{"sub":"aaaa1111-0000-4000-8000-000000000001","user_role":"administrativo"}', true);

select throws_ok(
  $$ select public.import_create_preview('base.xlsx', '   ') $$,
  'P0001', null,
  'escopo vazio e recusado: sem ele, ausente passa a ser calculado sobre a base inteira'
);

create temporary table t_job as
select * from public.import_create_preview('base.xlsx', 'TESTE Cidade');

select is(
  (select status::text from t_job), 'processando',
  'a previa nasce em `processando`, nao em `previa`'
);

select is(
  (select storage_path from t_job),
  'importacoes/' || (select id::text from t_job) || '.xlsx',
  'o caminho no bucket deriva do id do job: objeto orfao aponta de volta para um job'
);

select is(
  (select uploaded_by from t_job), 'aaaa1111-0000-4000-8000-000000000001'::uuid,
  'o job registra quem o criou'
);

-- ===========================================================================
-- Montagem: as linhas
-- ===========================================================================
insert into public.import_rows (import_id, line_number, status, raw_data)
select (select id from t_job), n,
       case when n = 4 then 'conflito' else 'novo' end::public.import_row_status,
       jsonb_build_object('city', case when n = 4 then 'SAO PAULO' else 'São Paulo' end,
                          'capture_methods', '[]'::jsonb)
  from generate_series(2, 6) as n;

select is(
  (select count(*)::int from public.import_rows where import_id = (select id from t_job)), 5,
  'as cinco linhas entraram no job em montagem'
);

-- ===========================================================================
-- A CONFERENCIA QUE NAO CONFIA NO CLIENTE
-- ===========================================================================
select throws_ok(
  format($$ select public.import_finalize_preview(%L, 9) $$, (select id from t_job)),
  'P0001', null,
  'total divergente do que o parser afirma e recusado'
);

-- Buraco na sequencia, num job proprio: o parser contaria 5 e gravaria 5, e os
-- dois numeros bateriam. Nenhuma comparacao com o total do cliente pegaria isto —
-- e e o caso do bug de laco, em que o parser conta errado de boa-fe.
--
-- Montado num job separado porque `import_rows` NAO tem policy de DELETE: linha
-- escrita e evidencia. O proprio teste esbarrou nisso, que e a guarda funcionando.
create temporary table t_furado as
select * from public.import_create_preview('furado.xlsx', 'TESTE Cidade');

insert into public.import_rows (import_id, line_number, status, raw_data)
select (select id from t_furado), n, 'novo',
       jsonb_build_object('city', 'São Paulo', 'capture_methods', '[]'::jsonb)
  from unnest(array[2, 3, 4, 5, 99]) as n;

select throws_ok(
  format($$ select public.import_finalize_preview(%L, 5) $$, (select id from t_furado)),
  'P0001', null,
  'sequencia com buraco e recusada MESMO com o total batendo: a checagem nao depende do cliente'
);

select is(
  (select status::text from public.import_jobs where id = (select id from t_furado)),
  'processando',
  'o job furado continua em `processando`: nao e commitavel, e aparece como interrompido'
);

-- ===========================================================================
-- Escopo declarado x cidades do arquivo, cruas e com contagem por grafia
-- ===========================================================================
select bag_eq(
  format($$ select cidade, linhas from public.import_cities(%L) $$, (select id from t_job)),
  $$ values ('São Paulo', 4::bigint), ('SAO PAULO', 1::bigint) $$,
  'as cidades saem CRUAS e contadas por grafia: normalizar esconderia a sujeira de origem'
);

-- ===========================================================================
-- Finalizar
-- ===========================================================================
create temporary table t_fim as
select * from public.import_finalize_preview((select id from t_job), 5, 9, 61);

select is((select status::text from t_fim), 'previa', 'lote conferido vira `previa`');
select is((select created_count from t_fim), 4, 'as contagens saem de group by no banco');
select is((select conflict_count from t_fim), 1, 'o conflito foi contado separado');
select is((select duplicated_capture_methods from t_fim), 9,
  'os meios duplicados na origem sao reportados, nao silenciados');

-- ===========================================================================
-- A BRECHA: injecao entre a revisao e o commit
-- ===========================================================================
-- O job saiu de `processando`. A partir daqui NINGUEM insere — nem quem criou.
select throws_ok(
  format($$ insert into public.import_rows (import_id, line_number, status, raw_data)
            values (%L, 7, 'novo', '{"capture_methods":[]}'::jsonb) $$, (select id from t_job)),
  '42501', null,
  'nem o proprio autor injeta linha numa previa ja fechada'
);

-- E outro usuario de gestao tambem nao, nem enquanto o job estava em montagem:
-- a policy escopa ao AUTOR, alem do estado.
select set_config('request.jwt.claims',
  '{"sub":"aaaa1111-0000-4000-8000-000000000002","user_role":"gestor_master"}', true);

create temporary table t_job_b as
select * from public.import_create_preview('outra.xlsx', 'TESTE Cidade');

select set_config('request.jwt.claims',
  '{"sub":"aaaa1111-0000-4000-8000-000000000001","user_role":"administrativo"}', true);

select throws_ok(
  format($$ insert into public.import_rows (import_id, line_number, status, raw_data)
            values (%L, 2, 'novo', '{"capture_methods":[]}'::jsonb) $$, (select id from t_job_b)),
  '42501', null,
  'gestao nao insere na previa EM MONTAGEM de outra pessoa'
);

-- ===========================================================================
-- Descartar
-- ===========================================================================
select throws_ok(
  format($$ select public.import_discard(%L, '') $$, (select id from t_job)),
  'P0001', null,
  'descarte sem motivo e recusado: o motivo e o que a auditoria registra'
);

-- `processando` E descartavel: e o estado do job interrompido, e sem saida alguem
-- resolveria por SQL direto.
select set_config('request.jwt.claims',
  '{"sub":"aaaa1111-0000-4000-8000-000000000002","user_role":"gestor_master"}', true);

select is(
  (select status::text from public.import_discard((select id from t_job_b), 'upload abandonado')),
  'cancelada',
  'job interrompido em `processando` tem saida pelo descarte'
);

select is(
  (select count(*)::int from public.import_rows where import_id = (select id from t_job)),
  5,
  'descartar NAO apaga as linhas: elas sao o registro do que alguem tentou importar'
);

-- Aplicada nao se descarta: nao desfaz nada e deixa o historico mentindo sobre o
-- que entrou na base. `concluida` e o estado que precisa ser recusado por nome.
update public.import_jobs set status = 'concluida' where id = (select id from t_job);

select throws_ok(
  format($$ select public.import_discard(%L, 'mudei de ideia') $$, (select id from t_job)),
  'P0001', null,
  'importacao ja aplicada NAO e descartavel, mesmo com motivo'
);

select * from finish();
rollback;
