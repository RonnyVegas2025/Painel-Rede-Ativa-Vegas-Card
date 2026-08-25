-- Redeclarar escopo: o caminho curto, e os exemplos que decidem por evidencia.
--
-- O que estas assercoes protegem:
--
-- 1. O CAMINHO CERTO PRECISA SER MAIS CURTO. Descartar, voltar a lista, subir 20 MB
--    de novo e declarar escopo tem quatro passos; digitar "1.412" tem um. Tornar a
--    saida visivel nao basta enquanto o errado for mais curto — e a licao do
--    PLATFORM-STANDARDS secao 8 aplicada a interface.
--
-- 2. OS EXEMPLOS DECIDEM. Um comercio que transacionou ontem na lista de "vai
--    virar ausente" e o sinal mais forte de escopo errado, e nao exige entender a
--    trava. Se os tres mais recentes transacionaram ha meses, e o contrario.
--    Tres nomes SORTEADOS nao diriam nem uma coisa nem outra.
--
-- 3. `excede` VEM COM O NUMERO. Se a base mudar e o total cair abaixo do limiar, a
--    tela precisa saber que a digitacao deixou de ser necessaria: atrito sem
--    motivo e o que corroi a trava.

begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('bbbb2222-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'admin@pgtap.invalid', '{"full_name":"Admin"}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbb2222-0000-4000-8000-000000000001","user_role":"administrativo"}', true);

-- Base: quatro estabelecimentos na cidade de fixture, com recencias distintas.
insert into public.establishments (id, external_contract, legal_name, trade_name,
                                   last_transaction_at, never_transacted)
values
  ('cccc3333-0000-4000-8000-00000000000a', 'TESTE-R-1', 'Um Ltda',    'TESTE Transacionou Ontem',   now() - interval '1 day',   false),
  ('cccc3333-0000-4000-8000-00000000000b', 'TESTE-R-2', 'Dois Ltda',  'TESTE Transacionou Semana',  now() - interval '7 days',  false),
  ('cccc3333-0000-4000-8000-00000000000c', 'TESTE-R-3', 'Tres Ltda',  'TESTE Transacionou Ano',     now() - interval '365 days',false),
  ('cccc3333-0000-4000-8000-00000000000d', 'TESTE-R-4', 'Quatro Ltda','TESTE Nunca Transacionou',   null,                       true);

-- Mais seis que VEM no arquivo. Sem eles o escopo teria so quatro, e 1 ausente
-- ja daria 25% — o cenario "caiu abaixo do limiar" nao seria encenavel. A primeira
-- versao deste teste tinha esse defeito e a assercao 8 o denunciou.
insert into public.establishments (external_contract, legal_name, trade_name, never_transacted)
select 'TESTE-R-1' || n, 'Enche ' || n, 'TESTE Enche ' || n, true
  from generate_series(0, 5) as n;

insert into public.establishment_addresses
  (establishment_id, street, street_name, street_number, district, cep, city, state, is_current)
select id, 'Rua T - N.º: 1 - Centro', 'Rua T', '1', 'Centro', '01000000', 'TESTE Cidade', 'SP', true
  from public.establishments where external_contract like 'TESTE-R-%';

-- Uma previa que traz so um dos quatro: tres sumiriam. 75%, acima do limiar.
create temporary table t as
select * from public.import_create_preview('recorte.xlsx', 'TESTE Cidade');

insert into public.import_rows (import_id, line_number, status, raw_data, establishment_id)
select (select id from t), row_number() over (order by e.external_contract) + 1,
       'inalterado', '{"capture_methods":[]}'::jsonb, e.id
  from public.establishments e
 where e.external_contract = 'TESTE-R-1'
    or e.external_contract like 'TESTE-R-1_';

-- ===========================================================================
-- O resumo que a tela le
-- ===========================================================================
select is(
  (select (public.import_absent_summary((select id from t)) ->> 'ausentes')::int), 3,
  'o resumo conta os tres que nao vieram'
);

select is(
  (select (public.import_absent_summary((select id from t)) ->> 'no_escopo')::int), 10,
  'o denominador e o escopo declarado, nao a base inteira'
);

select is(
  (select (public.import_absent_summary((select id from t)) ->> 'excede')::boolean), true,
  '30% acima do limiar de 20%: a confirmacao deliberada e exigida'
);

-- Os exemplos, ESCOLHIDOS por recencia. `TESTE Transacionou Ontem` veio no
-- arquivo, entao nao esta entre os que somem — quem lidera e o de sete dias.
select is(
  (select public.import_absent_summary((select id from t)) -> 'exemplos' -> 0 ->> 'trade_name'),
  'TESTE Transacionou Semana',
  'o primeiro exemplo e o de transacao MAIS RECENTE entre os que sumiriam'
);

select is(
  (select public.import_absent_summary((select id from t)) -> 'exemplos' -> 2 ->> 'trade_name'),
  'TESTE Nunca Transacionou',
  'quem nunca transacionou vem por ultimo: e o que menos sugere escopo errado'
);

select is(
  (select jsonb_array_length(public.import_absent_summary((select id from t)) -> 'exemplos')), 3,
  'no maximo tres exemplos: nome concreto derruba a abstracao do numero, lista nao'
);

-- ===========================================================================
-- `excede` acompanha a base, nao so a previa
-- ===========================================================================
-- Se os que sumiriam deixarem de contar — outra importacao ja os marcou, por
-- exemplo — a digitacao deixa de ser necessaria. Exigi-la ai e atrito sem motivo.
update public.establishments set absent_since = now()
 where id in ('cccc3333-0000-4000-8000-00000000000c', 'cccc3333-0000-4000-8000-00000000000d');

select is(
  (select (public.import_absent_summary((select id from t)) ->> 'ausentes')::int), 1,
  'quem ja estava marcado nao conta de novo'
);

select is(
  (select (public.import_absent_summary((select id from t)) ->> 'excede')::boolean), false,
  '`excede` cai junto com o numero: a tela volta ao modo comum, sem digitacao'
);

update public.establishments set absent_since = null
 where id in ('cccc3333-0000-4000-8000-00000000000c', 'cccc3333-0000-4000-8000-00000000000d');

-- ===========================================================================
-- Redeclarar: um passo, com a historia gravada
-- ===========================================================================
select throws_ok(
  format($$ select public.import_redeclare_scope(%L, 'TESTE Cidade') $$, (select id from t)),
  'P0001', null,
  'redeclarar para o MESMO escopo e recusado: daria o mesmo resultado'
);

create temporary table t2 as
select * from public.import_redeclare_scope((select id from t), 'TESTE Outra Cidade', 'era so a zona sul');

select is(
  (select status::text from public.import_jobs where id = (select id from t)),
  'cancelada',
  'a previa errada foi descartada na mesma acao'
);

select is(
  (select derivado_de_id from t2), (select id from t),
  'a nova importacao aponta para a descartada: a historia fica legivel em marco'
);

select is(
  (select error_message from public.import_jobs where id = (select id from t)),
  'descartada: escopo redeclarado para TESTE Outra Cidade — era so a zona sul',
  'o motivo e gravado pelo CONTEXTO: cobrar texto livre poria atrito no caminho certo'
);

select * from finish();
rollback;
