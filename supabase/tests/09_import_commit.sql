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

-- Fixtures a prova de colisao: `TESTE ` nos nomes e `.invalid` no e-mail. Ver a
-- nota em 08 — `Mercearia do Carlito` e `Padaria e Confeitaria` existem na
-- planilha real, e sem o prefixo este arquivo aborta em qualquer banco local
-- onde alguem tenha importado.

begin;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-00000000000c',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'importador@pgtap.invalid',
        '{"full_name":"Importador"}'::jsonb);

-- Sem usuario identificado o commit nao acontece: ele registra quem aplicou.
insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000001', 'a.xlsx', 'p/a.xlsx', 'TESTE Cidade', 1);

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
  'external_contract', 'TESTE-C-1',
  'cnpj', '11222333000181',
  'legal_name', 'TESTE Padaria Um Ltda',
  'trade_name', 'TESTE Padaria Um',
  'segment_source_name', 'TESTE Padaria e Confeitaria',
  'capture_methods', jsonb_build_array('TESTE CIELO'),
  'endereco_bruto', 'Rua Um - N.º: 10 - Centro',
  'street_name', 'Rua Um', 'street_number', '10', 'district', 'Centro',
  'cep', '01001000', 'city', 'TESTE Cidade', 'state', 'SP',
  'never_transacted', true
));

-- Contagens sobre as PROPRIAS fixtures, nao sobre a tabela inteira: contar a
-- tabela toda amarra a assercao ao estado do banco, e ela passa a falhar em
-- qualquer maquina onde alguem tenha importado.
select is(
  (select count(*)::integer from public.establishments where external_contract like 'TESTE-C-%'), 0,
  'gravar import_rows nao criou estabelecimento: a previa nao toca o dominio'
);
select is(
  (select count(*)::integer from public.capture_methods where source_name like 'TESTE %'), 0,
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
  (select count(*)::integer from public.establishments where external_contract = 'TESTE-C-1'), 1,
  'segunda chamada do MESMO job nao criou o estabelecimento de novo'
);

-- ===========================================================================
-- Conflito sem par e CRIADO, nao descartado
-- ===========================================================================
-- Dado perdido na importacao nao volta: pessoa fisica credenciada entra marcada
-- para decisao administrativa, nao rejeitada.

insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000002', 'b.xlsx', 'p/b.xlsx', 'TESTE Cidade', 1);

insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
values ('11111111-0000-4000-8000-000000000002', 2, 'conflito', jsonb_build_object(
  'external_contract', 'TESTE-C-2',
  'cnpj', null,
  'legal_name', 'Carlito Barbosa',
  'trade_name', 'TESTE Mercearia do Carlito',
  'segment_source_name', 'TESTE Padaria e Confeitaria',
  'capture_methods', jsonb_build_array('TESTE FIRST'),
  'endereco_bruto', 'Rua Dois - N.º: 20 - Centro',
  'street_name', 'Rua Dois', 'street_number', '20', 'district', 'Centro',
  'cep', '01002000', 'city', 'TESTE Cidade', 'state', 'SP',
  'never_transacted', true
), null);

-- O arquivo tambem traz o que ja existe: importacao e SINCRONIZACAO, e um
-- arquivo com so a linha nova significaria que todo o resto sumiu — que e
-- exatamente o que a trava de ausentes existe para barrar.
insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select '11111111-0000-4000-8000-000000000002', 3, 'inalterado',
       jsonb_build_object('capture_methods', jsonb_build_array('TESTE CIELO')), id
  from public.establishments where external_contract = 'TESTE-C-1';

select lives_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000002') $$,
  'conflito sem par nao quebra o commit'
);

select is(
  (select count(*)::integer from public.establishments where trade_name = 'TESTE Mercearia do Carlito'),
  1, 'conflito sem par foi CRIADO — dado perdido na importacao nao volta'
);

select is(
  (select count(*)::integer from public.establishment_addresses a
     join public.establishments e on e.id = a.establishment_id
    where e.trade_name = 'TESTE Mercearia do Carlito' and a.is_current),
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
values ('11111111-0000-4000-8000-000000000003', 'c.xlsx', 'p/c.xlsx', 'TESTE Cidade', 1);

insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select '11111111-0000-4000-8000-000000000003', 2, 'inalterado',
       jsonb_build_object('capture_methods', '[]'::jsonb), id
  from public.establishments where external_contract = 'TESTE-C-1';

select throws_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000003') $$,
  'P0001', null,
  'importacao que deixaria 50% do escopo ausente para e exige confirmacao'
);

-- E ela para ANTES de escrever: o job continua em `previa` e nada foi marcado.
select is(
  (select count(*)::integer from public.establishments
    where absent_since is not null and external_contract like 'TESTE-C-%'),
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


-- ===========================================================================
-- REAPARECER DESMARCA — para qualquer status
-- ===========================================================================
-- O aceite do E-005 declarou "segunda passada, zero ausentes" e nunca exercitou
-- este caso: a base nao tinha ninguem marcado para reaparecer. A verificacao
-- estava incompleta, nao so o codigo.
--
-- `atualizado` responde "o dado mudou?". Desmarcar depende de "apareceu no
-- arquivo?". Enquanto a limpeza morou dentro daquele ramo, o caso MAIS COMUM —
-- a linha volta identica — mantinha a marca para sempre.

insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000004', 'ant.xlsx', 'p/ant.xlsx', 'TESTE Cidade', 0);

insert into public.establishments (id, external_contract, legal_name, trade_name,
                                   absent_since, absent_from_import, updated_at)
values
  ('44444444-0000-4000-8000-00000000000a', 'TESTE-C-10', 'Volta Igual Ltda', 'Volta Igual',
   now() - interval '90 days', '11111111-0000-4000-8000-000000000004', '2020-01-01'),
  ('44444444-0000-4000-8000-00000000000b', 'TESTE-C-11', 'Volta Mudada Ltda', 'Volta Mudada',
   now() - interval '90 days', '11111111-0000-4000-8000-000000000004', '2020-01-01');

insert into public.establishment_addresses
  (establishment_id, street, street_name, street_number, district, cep, city, state, is_current)
values
  ('44444444-0000-4000-8000-00000000000a', 'Rua Dez - N.º: 10 - Centro',  'Rua Dez',  '10', 'Centro', '01010000', 'TESTE Cidade', 'SP', true),
  ('44444444-0000-4000-8000-00000000000b', 'Rua Onze - N.º: 11 - Centro', 'Rua Onze', '11', 'Centro', '01011000', 'TESTE Cidade', 'SP', true);

-- `updated_at` no passado de proposito.
--
-- Duas armadilhas aqui, e as duas fazem a assercao passar sem verificar nada:
--
-- 1. Dentro de uma transacao pgTAP `now()` e constante. Comparar now() com now()
--    passa mesmo se o gatilho tiver disparado. Por isso uma data DISTINTA.
-- 2. `establishments_touch` e BEFORE UPDATE: ele sobrescreve o proprio seed.
--    Semear com UPDATE sem desliga-lo grava now(), nao 2020 — e ai a assercao
--    compara duas datas iguais por outro motivo. Desligado so para semear.
--
-- C-1 nunca foi marcado como ausente: esteve em todas as importacoes ate aqui.
-- (C-2 foi marcado pelo job 3 e vai reaparecer agora, entao o updated_at DELE
-- muda com razao — nao serve de sujeito para esta assercao.)
alter table public.establishments disable trigger establishments_touch;
update public.establishments set updated_at = '2020-01-01'
 where external_contract = 'TESTE-C-1';
alter table public.establishments enable trigger establishments_touch;

insert into public.import_jobs (id, file_name, storage_path, scope_city, total_rows)
values ('11111111-0000-4000-8000-000000000005', 'volta.xlsx', 'p/volta.xlsx', 'TESTE Cidade', 4);

-- Os dois que voltam, um sem mudar e outro mudando; e os dois que ja estavam la,
-- para a importacao nao parecer um recorte e disparar a trava.
insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
values
  ('11111111-0000-4000-8000-000000000005', 2, 'inalterado',
   jsonb_build_object('capture_methods', '[]'::jsonb), '44444444-0000-4000-8000-00000000000a'),
  ('11111111-0000-4000-8000-000000000005', 3, 'atualizado',
   jsonb_build_object('capture_methods', '[]'::jsonb,
                      'legal_name', 'Volta Mudada Ltda', 'trade_name', 'Volta Mudada Agora',
                      'city', 'TESTE Cidade', 'state', 'SP',
                      'endereco_bruto', 'Rua Onze - N.º: 11 - Centro',
                      'street_name', 'Rua Onze', 'street_number', '11',
                      'district', 'Centro', 'cep', '01011000'),
   '44444444-0000-4000-8000-00000000000b');

insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select '11111111-0000-4000-8000-000000000005', 4, 'inalterado',
       jsonb_build_object('capture_methods', '[]'::jsonb), id
  from public.establishments where external_contract = 'TESTE-C-1';
insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select '11111111-0000-4000-8000-000000000005', 5, 'inalterado',
       jsonb_build_object('capture_methods', '[]'::jsonb), id
  from public.establishments where external_contract = 'TESTE-C-2';

select lives_ok(
  $$ select public.import_commit('11111111-0000-4000-8000-000000000005') $$,
  'a importacao com os reaparecidos aplica'
);

select is(
  (select absent_since from public.establishments where id = '44444444-0000-4000-8000-00000000000a'),
  null,
  'reapareceu INALTERADO e a marca de ausencia saiu — o caso mais comum, que falhava'
);

select is(
  (select absent_from_import from public.establishments where id = '44444444-0000-4000-8000-00000000000a'),
  null,
  'a referencia a importacao que marcou tambem saiu'
);

select is(
  (select absent_since from public.establishments where id = '44444444-0000-4000-8000-00000000000b'),
  null,
  'reapareceu ATUALIZADO e a marca saiu: a limpeza vale para qualquer status'
);

-- Quem nunca esteve marcado nao pode ser tocado. Sem `absent_since is not null`
-- no update, o gatilho de updated_at dispararia em toda a base e a impressao
-- digital que prova a idempotencia mudaria sem nenhum dado ter mudado.
select is(
  (select updated_at from public.establishments where external_contract = 'TESTE-C-1'),
  '2020-01-01'::timestamptz,
  'quem nunca esteve marcado ficou com updated_at intocado'
);

select * from finish();
rollback;
