-- Resolucao da fila de normalizacao: as quatro acoes, e a atomicidade.
--
-- O que estas assercoes protegem, e que nenhuma outra protege: cada acao e MAIS
-- DE UMA ESCRITA, e as escritas nao sao independentes. Feitas em chamadas
-- separadas pelo PostgREST, cada uma seria sua propria transacao, e meio caminho
-- deixaria estado incoerente em silencio — regra migrada sem o alias gravado tira
-- a elegibilidade do segmento antigo sem dar a ninguem.

-- FIXTURES A PROVA DE COLISAO
--
-- `source_name` com prefixo `TESTE ` e e-mail em `.invalid` (TLD reservado, que
-- nunca resolve). Sem isso, `Padaria e Confeitaria` — que existe na planilha real
-- — colide com a base de quem importou localmente, e o arquivo inteiro aborta em
-- violacao de unicidade antes da primeira assercao.
--
-- Trabalhar no E-006, E-007 e E-008 significa ter a base importada no banco local.
-- Teste que fica vermelho por isso e teste que as pessoas aprendem a ignorar.
-- O prefixo nao enfraquece nada: o typo da origem continua preservado no valor,
-- que e o que a assercao verifica.

begin;
select plan(13);

-- Sessao: as RPCs gravam quem revisou, entao exigem usuario identificado.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-000000000009',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'operador@pgtap.invalid',
        '{"full_name":"Operador da Fila"}'::jsonb);

-- Sem claims, `auth.uid()` e nulo e a acao nao pode acontecer.
select throws_ok(
  $$ select public.resolve_segment_deactivate('00000000-0000-0000-0000-000000000000') $$,
  'P0001',
  null,
  'acao da fila sem usuario identificado e recusada com a frase certa'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"eeeeeeee-0000-4000-8000-000000000009","user_role":"gestor_master"}',
  true
);

insert into public.card_products (id, name, slug, eligibility_mode) values
  ('cccccccc-0000-4000-8000-00000000000a', 'Farmacia Teste',   'farmacia-teste',   'allowlist'),
  ('cccccccc-0000-4000-8000-00000000000b', 'Alimentacao Teste','alimentacao-teste','allowlist');

insert into public.segments (id, source_name, normalized_name, category) values
  ('dddddddd-0000-4000-8000-00000000000a', 'TESTE Comercio varejista de produtos farmaceutico', 'TESTE Comercio varejista de produtos farmaceutico', 'outros'),
  ('dddddddd-0000-4000-8000-00000000000b', 'TESTE Comercio Verejista - Supermercados',          'TESTE Comercio Verejista - Supermercados',          'outros'),
  ('dddddddd-0000-4000-8000-00000000000c', 'TESTE Padaria e Confeitaria',                       'TESTE Padaria e Confeitaria',                       'outros');

-- ===========================================================================
-- Criar como segmento proprio, ja definindo as modalidades
-- ===========================================================================
-- Fecha o ciclo do ADR 0003: resolver a fila responde "que segmento e este", e
-- as modalidades respondem "quais aceitam" — sem a segunda, nada fica elegivel.

select lives_ok(
  $$ select public.resolve_segment_create(
       'dddddddd-0000-4000-8000-00000000000a',
       'Farmácia', 'farmacia',
       array['cccccccc-0000-4000-8000-00000000000a']::uuid[], '{}'::uuid[]) $$,
  'criar segmento proprio define nome, categoria e modalidades numa passagem'
);

select is(
  (select normalized_name from public.segments where id = 'dddddddd-0000-4000-8000-00000000000a'),
  'Farmácia',
  'o nome de exibicao foi corrigido'
);

-- O valor cru NUNCA muda: e a chave de reconciliacao. Mudar aqui faria a proxima
-- importacao criar duplicata e reabrir o item na fila.
select is(
  (select source_name from public.segments where id = 'dddddddd-0000-4000-8000-00000000000a'),
  'TESTE Comercio varejista de produtos farmaceutico',
  'source_name permanece o valor cru da planilha, com o typo da origem'
);

select bag_eq(
  $$ select segment_id from public.eligible_segments('cccccccc-0000-4000-8000-00000000000a') $$,
  $$ values ('dddddddd-0000-4000-8000-00000000000a'::uuid) $$,
  'o segmento criado passa a ser elegivel na modalidade escolhida'
);

select is_empty(
  $$ select id from public.segment_normalization_queue
      where id = 'dddddddd-0000-4000-8000-00000000000a' $$,
  'o item sai da fila'
);

-- ===========================================================================
-- Confirmar como esta
-- ===========================================================================
select lives_ok(
  $$ select public.resolve_segment_confirm(
       'dddddddd-0000-4000-8000-00000000000b',
       array['cccccccc-0000-4000-8000-00000000000b']::uuid[], '{}'::uuid[]) $$,
  'confirmar como esta tambem define modalidades'
);

select is(
  (select count(*)::int from public.product_segments
    where segment_id = 'dddddddd-0000-4000-8000-00000000000b'),
  1,
  'a modalidade foi gravada ao confirmar'
);

-- ===========================================================================
-- Mapear, migrando a regra pendurada
-- ===========================================================================
insert into public.product_segments (card_product_id, segment_id, rule_type)
values ('cccccccc-0000-4000-8000-00000000000b', 'dddddddd-0000-4000-8000-00000000000c', 'allow');

select lives_ok(
  $$ select public.resolve_segment_map(
       'dddddddd-0000-4000-8000-00000000000c',
       'dddddddd-0000-4000-8000-00000000000b',
       array['cccccccc-0000-4000-8000-00000000000b']::uuid[], '{}'::uuid[]) $$,
  'mapear migra a regra pendurada e grava o alias na mesma transacao'
);

select is(
  (select canonical_segment_id from public.segments
    where id = 'dddddddd-0000-4000-8000-00000000000c'),
  'dddddddd-0000-4000-8000-00000000000b'::uuid,
  'o alias ficou gravado'
);

select is_empty(
  $$ select 1 from public.product_segments
      where segment_id = 'dddddddd-0000-4000-8000-00000000000c' $$,
  'a regra saiu do alias: quem governa e o canonico'
);

-- ===========================================================================
-- ATOMICIDADE — o que justifica a RPC existir
-- ===========================================================================
-- Mapear com regra NAO resolvida: a trigger recusa o alias, e tudo o que a
-- funcao ja tinha feito precisa voltar junto. Se a migracao sobrevivesse, o
-- segmento perderia a elegibilidade sem ganhar alias — pior que nao ter tentado.

insert into public.segments (id, source_name, normalized_name, category)
values ('dddddddd-0000-4000-8000-00000000000d', 'TESTE Comercio varejista de carnes e pescados', 'Carnes', 'outros');

insert into public.product_segments (card_product_id, segment_id, rule_type) values
  ('cccccccc-0000-4000-8000-00000000000a', 'dddddddd-0000-4000-8000-00000000000d', 'allow'),
  ('cccccccc-0000-4000-8000-00000000000b', 'dddddddd-0000-4000-8000-00000000000d', 'allow');

-- Resolve so UMA das duas regras. A outra faz a trigger recusar.
select throws_ok(
  $$ select public.resolve_segment_map(
       'dddddddd-0000-4000-8000-00000000000d',
       'dddddddd-0000-4000-8000-00000000000b',
       array['cccccccc-0000-4000-8000-00000000000a']::uuid[], '{}'::uuid[]) $$,
  'P0001',
  null,
  'mapear com regra nao resolvida e recusado'
);

select is(
  (select count(*)::int from public.product_segments
    where segment_id = 'dddddddd-0000-4000-8000-00000000000d'),
  2,
  'a migracao parcial foi DESFEITA: as duas regras continuam no segmento'
);

select * from finish();
rollback;
