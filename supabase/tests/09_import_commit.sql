-- O commit da importacao: a trava de ausentes, a repeticao, e o conflito sem par.
--
-- O que estas assercoes protegem, e que nenhuma outra protege:
--
-- 1. A TRAVA DE 20%. Na base real ela nao dispara — a primeira importacao entra
--    numa base vazia e nao ha ausente possivel. Sem um teste que force o cenario,
--    ela so seria exercitada em producao, no dia em que alguem exportasse a
--    planilha com um filtro aplicado. Aqui o cenario e construido de proposito.
--
-- 2. A REPETICAO. Botao clicado duas vezes, ou requisicao que caiu depois de
--    gravar, nao podem importar duas vezes.
--
-- 3. O CONFLITO SEM PAR. `conflito` responde "ha decisao administrativa
--    pendente", nao "casou com alguem". A linha do CPF na base real e conflito E
--    e nova; tratar `status` como resposta de identidade a perdia em silencio.

begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-00000000000c',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'importador@vegas.local',
        '{"full_name":"Importador"}'::jsonb);

-- Sem usuario identificado o commit nao acontece: ele registra quem aplicou.
insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000001', 'a.xlsx', 'p/a.xlsx', 'São Paulo', 1);

select throws_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000001') $$,
  'P0001', null,
  'commit sem usuario identificado e recusado'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-00000000000c","user_role":"gestor_master"}',
  true
);

-- ===========================================================================
-- A previa nao escreve no dominio
-- ===========================================================================
-- `import_jobs` e `import_rows` SAO a saida da previa — e delas que saem o
-- relatorio e a lista de ausentes. O criterio e sobre as tabelas de dominio.

insert into public.import_rows (import_id, line_number, status, raw_data)
values ('11111111-0000-4000-8000-000000000001', 2, 'novo', jsonb_build_object(
  'external_contract', 'C-1',
  'cnpj', '11222333000181',
  'legal_name', 'Padaria Um Ltda',
  'trade_name', 'Padaria Um',
  'segment_source_name', 'Padaria e Confeitaria',
  'capture_methods', jsonb_build_array('CIELO'),
  'endereco_bruto', 'Rua Um - N.º: 10 - Centro',
  'street_name', 'Rua Um', 'street_number', '10', 'district', 'Centro',
  'cep', '01001000', 'city', 'São Paulo', 'state', 'SP',
  'never_transacted', true
));

select is(
  (select count(*)::integer from public.establishments), 0,
  'gravar import_rows nao criou estabelecimento: a previa nao toca o dominio'
);
select is(
  (select count(*)::integer from public.capture_methods), 0,
  'gravar import_rows nao criou meio de captura'
);

select lives_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000001') $$,
  'o commit aplica a previa'
);

select is(
  (select created_count from public.import_jobs where id = '11111111-0000-4000-8000-000000000001'),
  1, 'um estabelecimento criado'
);

-- ===========================================================================
-- Repeticao: o estado do job serializa, nada e reaplicado
-- ===========================================================================
select lives_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000001') $$,
  'chamar o commit de novo nao levanta erro — devolve o resultado anterior'
);

select is(
  (select count(*)::integer from public.establishments), 1,
  'segunda chamada do MESMO job nao criou o estabelecimento de novo'
);

-- ===========================================================================
-- Conflito sem par e CRIADO, nao descartado
-- ===========================================================================
-- Dado perdido na importacao nao volta: pessoa fisica credenciada entra marcada
-- para decisao administrativa, nao rejeitada.

insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000002', 'b.xlsx', 'p/b.xlsx', 'São Paulo', 1);

insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
values ('11111111-0000-4000-8000-000000000002', 2, 'conflito', jsonb_build_object(
  'external_contract', 'C-2',
  'cnpj', null,
  'legal_name', 'Carlito Barbosa',
  'trade_name', 'Mercearia do Carlito',
  'segment_source_name', 'Padaria e Confeitaria',
  'capture_methods', jsonb_build_array('FIRST'),
  'endereco_bruto', 'Rua Dois - N.º: 20 - Centro',
  'street_name', 'Rua Dois', 'street_number', '20', 'district', 'Centro',
  'cep', '01002000', 'city', 'São Paulo', 'state', 'SP',
  'never_transacted', true
), null);

-- O arquivo tambem traz o que ja existe: importacao e SINCRONIZACAO, e um
-- arquivo com so a linha nova significaria que todo o resto sumiu — que e
-- exatamente o que a trava de ausentes existe para barrar.
insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select '11111111-0000-4000-8000-000000000002', 3, 'inalterado',
       jsonb_build_object('capture_methods', jsonb_build_array('CIELO')), id
  from public.establishments where external_contract = 'C-1';

select lives_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000002') $$,
  'conflito sem par nao quebra o commit'
);

select is(
  (select count(*)::integer from public.establishments where trade_name = 'Mercearia do Carlito'),
  1, 'conflito sem par foi CRIADO — dado perdido na importacao nao volta'
);

select is(
  (select count(*)::integer from public.establishment_addresses a
     join public.establishments e on e.id = a.establishment_id
    where e.trade_name = 'Mercearia do Carlito' and a.is_current),
  1, 'o conflito recem-criado tem endereco corrente: sem ele nao ha hash de identidade'
);

-- ===========================================================================
-- A TRAVA DE 20%
-- ===========================================================================
-- Ha 2 estabelecimentos em São Paulo. Uma importacao com escopo São Paulo que
-- traz so 1 deixaria 1 de 2 ausentes — 50%, acima do limiar de 20%.
--
-- Nada seria excluido: ausente e marcado, nunca apagado (ADR 0011). Mas uma fila
-- administrativa cheia por causa de um filtro esquecido na exportacao e
-- indistinguivel de ruido, e limpar custa mais que reimportar.

insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000003', 'c.xlsx', 'p/c.xlsx', 'São Paulo', 1);

insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select '11111111-0000-4000-8000-000000000003', 2, 'inalterado',
       jsonb_build_object('capture_methods', '[]'::jsonb), id
  from public.establishments where external_contract = 'C-1';

select throws_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000003') $$,
  'P0001', null,
  'importacao que deixaria 50% do escopo ausente para e exige confirmacao'
);

-- E ela para ANTES de escrever: o job continua em `previa` e nada foi marcado.
select is(
  (select count(*)::integer from public.establishments where absent_since is not null),
  0, 'a trava disparou antes de qualquer escrita — nenhum ausente marcado'
);

-- Confirmada explicitamente, aplica.
update public.import_jobs
   set confirmed_at = now(),
       confirmed_by = 'eeeeeeee-0000-4000-8000-00000000000c'
 where id = '11111111-0000-4000-8000-000000000003';

select is(
  (select missing_count from public.import_commit('11111111-0000-4000-8000-000000000003')),
  1, 'com confirmacao explicita a importacao aplica e marca o ausente'
);

select * from finish();
rollback;
