-- Invariantes das tabelas da Sprint 1.
--
-- Verificados por COMPORTAMENTO, nao por catalogo. Conferir que um indice existe
-- prova que alguem escreveu `create index`; conferir que a segunda linha e
-- recusada prova que a regra vale. A diferenca aparece quando o indice existe mas
-- com a clausula `where` errada — que e exatamente o risco dos quatro indices
-- parciais desta sprint.

begin;
select plan(15);

-- Fixtures locais. O rollback no fim descarta tudo.
insert into public.establishments (id, external_contract, cnpj, legal_name, trade_name)
values ('11111111-1111-1111-1111-111111111111', 'C-001', '11222333000181', 'Alfa LTDA', 'Alfa');

-- ===========================================================================
-- Identidade (ADR 0001)
-- ===========================================================================

-- O mesmo CNPJ tem varias lojas. Colapsa-las impediria o consultor de visitar a
-- segunda — e o motivo de cnpj ser atributo indexado, nunca chave.
select lives_ok(
  $$ insert into public.establishments (id, external_contract, cnpj, legal_name, trade_name)
     values ('22222222-2222-2222-2222-222222222222', 'C-002', '11222333000181', 'Alfa LTDA', 'Alfa Loja 2') $$,
  'o mesmo CNPJ aceita mais de um estabelecimento'
);

select throws_ok(
  $$ insert into public.establishments (external_contract, cnpj, legal_name, trade_name)
     values ('C-001', '99888777000166', 'Beta LTDA', 'Beta') $$,
  23505,
  null,
  'contrato externo duplicado e recusado: e a identidade prioritaria'
);

-- ===========================================================================
-- Um endereco corrente por estabelecimento
-- ===========================================================================
-- Sem isto, "mudou de endereco" deixa dois correntes e o check-in por raio da
-- Sprint 3 passa a usar coordenada arbitraria — bug longe da causa.

insert into public.establishment_addresses (establishment_id, street, cep, city, state, is_current)
values ('11111111-1111-1111-1111-111111111111', 'Av. Paulista, 1578', '01310200', 'Sao Paulo', 'SP', true);

select throws_ok(
  $$ insert into public.establishment_addresses (establishment_id, street, city, state, is_current)
     values ('11111111-1111-1111-1111-111111111111', 'Rua Nova, 10', 'Sao Paulo', 'SP', true) $$,
  23505,
  null,
  'dois enderecos correntes no mesmo estabelecimento sao recusados'
);

select lives_ok(
  $$ insert into public.establishment_addresses (establishment_id, street, city, state, is_current)
     values ('11111111-1111-1111-1111-111111111111', 'Rua Antiga, 5', 'Sao Paulo', 'SP', false) $$,
  'endereco historico convive com o corrente'
);

-- ===========================================================================
-- Endereco normalizado: gerado pelo banco, nao gravavel
-- ===========================================================================
-- O ADR 0001 exige persistir a normalizacao. Persistir e deixar a aplicacao
-- gravar sao coisas diferentes: um defeito no importador escreveria hash
-- divergente, e hash divergente so se corrige com migracao de dados.

select throws_ok(
  $$ insert into public.establishment_addresses
       (establishment_id, street, city, state, is_current, normalized_address)
     values ('22222222-2222-2222-2222-222222222222', 'Rua X', 'Sao Paulo', 'SP', true, 'valor forjado') $$,
  '428C9',  -- cannot insert a non-DEFAULT value into a generated column
  null,
  'normalized_address nao aceita escrita: quem calcula e o banco'
);

select is(
  (select normalized_address from public.establishment_addresses
   where establishment_id = '11111111-1111-1111-1111-111111111111' and is_current),
  public.normalize_address('Av. Paulista, 1578', '01310200'),
  'normalized_address gravado e o resultado da propria funcao'
);

-- ===========================================================================
-- Pontos de captura
-- ===========================================================================

insert into public.establishment_capture_points (establishment_id, terminal_number, status, is_primary)
values ('11111111-1111-1111-1111-111111111111', 'T-100', 'ativo', true);

select throws_ok(
  $$ insert into public.establishment_capture_points (establishment_id, terminal_number, is_primary)
     values ('11111111-1111-1111-1111-111111111111', 'T-200', true) $$,
  23505,
  null,
  'dois pontos primarios no mesmo estabelecimento sao recusados'
);

select lives_ok(
  $$ insert into public.establishment_capture_points (establishment_id, terminal_number, is_primary)
     values ('11111111-1111-1111-1111-111111111111', 'T-200', false) $$,
  'segundo ponto nao primario e aceito'
);

select throws_ok(
  $$ insert into public.establishment_capture_points (establishment_id, terminal_number, status)
     values ('11111111-1111-1111-1111-111111111111', 'T-100', 'ativo') $$,
  23505,
  null,
  'terminal repetido entre pontos ATIVOS do mesmo estabelecimento e recusado'
);

-- O indice e parcial de proposito: equipamento trocado deixa o ponto antigo como
-- historico, e ponto historico nao pode bloquear o novo.
select lives_ok(
  $$ insert into public.establishment_capture_points (establishment_id, terminal_number, status)
     values ('11111111-1111-1111-1111-111111111111', 'T-100', 'substituido') $$,
  'o mesmo terminal convive se o ponto antigo esta substituido'
);

-- ===========================================================================
-- never_transacted x last_transaction_at
-- ===========================================================================
-- A redundancia e proposital: nulo pode ser "nunca transacionou" ou "nao
-- informado", e a planilha distingue com o texto `Nunca Transacionou`.
-- Redundancia sem constraint diverge.

select throws_ok(
  $$ insert into public.establishments (external_contract, legal_name, trade_name, never_transacted, last_transaction_at)
     values ('C-900', 'Gama', 'Gama', true, now()) $$,
  23514,
  null,
  'never_transacted com data de transacao e recusado'
);

select lives_ok(
  $$ insert into public.establishments (external_contract, legal_name, trade_name, never_transacted)
     values ('C-901', 'Delta', 'Delta', true) $$,
  'never_transacted sem data e aceito'
);

-- ===========================================================================
-- capture_methods nasce vazia
-- ===========================================================================
-- Semear com nomes escolhidos a mao criaria o mesmo defeito de reconciliacao que
-- source_name existe para evitar: se a planilha grafar "STONE PAGAMENTOS", o seed
-- cria um registro e o importador cria outro.
select is(
  (select count(*)::int from public.capture_methods),
  0,
  'capture_methods nasce vazia: quem popula e o importador, pelo valor cru de Captacao'
);

-- ===========================================================================
-- Escrita da linha crua e das exclusoes
-- ===========================================================================

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'import_rows'
     and cmd in ('INSERT','UPDATE','DELETE')),
  0,
  'import_rows nao tem policy de escrita: a linha crua e evidencia, nao dado editavel'
);

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and cmd = 'DELETE'
     and tablename in ('establishments','establishment_addresses',
                       'establishment_capture_points','capture_methods',
                       'import_jobs','import_rows')),
  0,
  'nenhuma tabela da Sprint 1 tem policy de delete: desativa-se com is_active'
);

select * from finish();
rollback;
