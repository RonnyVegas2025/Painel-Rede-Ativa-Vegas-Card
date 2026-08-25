-- Invariantes das tabelas da Sprint 1.
--
-- Verificados por COMPORTAMENTO, nao por catalogo. Conferir que um indice existe
-- prova que alguem escreveu `create index`; conferir que a segunda linha e
-- recusada prova que a regra vale. A diferenca aparece quando o indice existe mas
-- com a clausula `where` errada — que e exatamente o risco dos quatro indices
-- parciais desta sprint.

begin;
select plan(18);

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

-- A base real traz `Logradouro - N.º: X - Bairro`. `street` guarda a string
-- bruta; os componentes parseados alimentam o hash (migrations 0027 e 0028).
insert into public.establishment_addresses
  (establishment_id, street, street_name, street_number, district, cep, city, state, is_current)
values ('11111111-1111-1111-1111-111111111111',
        'Rua Harmonia - N.º: 373 - Sumarezinho',
        'Rua Harmonia', '373', 'Sumarezinho',
        '01310200', 'Sao Paulo', 'SP', true);

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

-- Valor esperado explicito, e nao a formula repetida: o hash e sobre os
-- COMPONENTES, entao o rotulo `N.º:` do formulario de origem nao entra. Se ele
-- entrasse, o resultado traria "n o" no meio.
select is(
  (select normalized_address from public.establishment_addresses
   where establishment_id = '11111111-1111-1111-1111-111111111111' and is_current),
  'rua harmonia 373 sumarezinho 01310200',
  'normalized_address vem dos componentes: o rotulo do formulario fica de fora'
);

-- ===========================================================================
-- Pontos de captura
-- ===========================================================================

-- A base real nao tem numero de terminal: a coluna `Terminal` traz nome de
-- adquirente e gateway separados por `/`, e zero dos 1.804 valores contem digito.
-- Uma linha por MEIO por estabelecimento, com terminal_number nulo.
insert into public.establishment_capture_points
  (establishment_id, capture_method_id, terminal_number, status, is_primary)
values ('11111111-1111-1111-1111-111111111111', null, null, 'ativo', true);

select lives_ok(
  $$ insert into public.establishment_capture_points
       (establishment_id, terminal_number, status)
     values ('11111111-1111-1111-1111-111111111111', null, 'ativo') $$,
  'varios meios no mesmo estabelecimento convivem: 661 tem tres na base real'
);

select throws_ok(
  $$ insert into public.establishment_capture_points (establishment_id, is_primary)
     values ('11111111-1111-1111-1111-111111111111', true) $$,
  23505,
  null,
  'dois pontos primarios no mesmo estabelecimento sao recusados'
);

-- `is_primary` nao e derivavel da planilha: deduzir o principal pela ordem em que
-- os meios aparecem numa string seria dado fabricado. Fica nulo, e o indice
-- parcial simplesmente nao dispara — o que precisa continuar sendo verdade.
select lives_ok(
  $$ insert into public.establishment_capture_points (establishment_id, is_primary)
     values ('11111111-1111-1111-1111-111111111111', null),
            ('11111111-1111-1111-1111-111111111111', null) $$,
  'varios pontos com is_primary nulo convivem: nulo nao e primario'
);

-- Nao ha unicidade de terminal, e a ausencia e deliberada. Se alguem recriar o
-- indice por simetria com o desenho antigo, a importacao passa a rejeitar as
-- ~3.600 linhas em que terminal_number e nulo.
select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public'
      and tablename = 'establishment_capture_points'
      and indexdef ilike '%terminal_number%'),
  0,
  'nao existe indice sobre terminal_number: a base nao tem numero de terminal'
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
-- capture_methods so contem o que veio de uma importacao
-- ===========================================================================
-- Semear com nomes escolhidos a mao criaria o mesmo defeito de reconciliacao que
-- source_name existe para evitar. E a origem nao e `Captacao`, como se supunha:
-- aquela coluna diz como o comercio foi CREDENCIADO — Pessoalmente, E-Mail,
-- Telefone — e virou establishments.acquisition_channel. Os meios vem de
-- `Terminal`, separados por `/`.
--
-- A assercao era `count(*) = 0`, e estava errada de forma — nao de conteudo.
--
-- "Nasce vazia" e um fato sobre o SEED, nao um invariante do schema: ela fica
-- vermelha em todo banco local onde alguem importou, que e exatamente o que se
-- faz trabalhando no E-006, E-007 e E-008. Teste que fica vermelho por motivo
-- legitimo e rotineiro e teste que as pessoas aprendem a ignorar — e quando ele
-- ficar vermelho pelo motivo certo, ninguem vai olhar.
--
-- O invariante que sobrevive a base importada e mais forte: toda linha tem
-- origem RASTREAVEL numa importacao. Base recem-instalada tem zero linhas e
-- passa; base importada tem 13 e passa; migration ou seed que inventar um nome
-- produz linha sem origem e falha nos dois estados.
select is(
  (select count(*)::int from public.capture_methods cm
    where not exists (
      select 1
        from public.import_rows r
        cross join lateral jsonb_array_elements_text(
          coalesce(r.raw_data -> 'capture_methods', '[]'::jsonb)
        ) as m(valor)
       where m.valor = cm.source_name
    )),
  0,
  'capture_methods so contem meios rastreaveis a uma importacao: ninguem semeia a mao'
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

-- ===========================================================================
-- Recalculo: nenhum valor gravado diverge da funcao atual
-- ===========================================================================
-- O vetor que a coluna gerada abriu, e que nenhuma outra verificacao pega.
--
-- `create or replace function normalize_address(...)` NAO recalcula o que ja
-- esta gravado. Verificado: alterando a funcao com linhas na tabela, o valor
-- armazenado permanece o da regra antiga enquanto a funcao ja devolve a nova. A
-- tabela passa a conter as duas regras, indistinguiveis, sem erro nem aviso.
--
-- O arnes de paridade NAO cobre isto: ele compara as duas implementacoes ATUAIS
-- entre si, nunca o que esta gravado contra a funcao corrente. Sao verificacoes
-- de coisas diferentes.
--
-- Politica escrita tambem nao cobre: o ADR 0001 declara a funcao congelada, e
-- congelada em documento nao impede `create or replace`. Isto impede.
--
-- Quem alterar a funcao tem de recalcular na mesma migration, com um `update`
-- que force a regravacao das colunas geradas. Se nao fizer, isto falha no CI.

-- COMO A VERIFICACAO E FEITA, E POR QUE MUDOU
--
-- A primeira versao repetia a formula da coluna gerada dentro do teste. A
-- migration 0028 mudou a expressao — passou a usar os componentes em vez da
-- string bruta — e o teste passou a acusar divergencia onde nao havia: ele
-- comparava o valor gravado com uma formula que ja nao era a da coluna.
--
-- Restar a formula e sempre isso: duas copias livres para divergir, e o teste
-- vira fonte de alarme falso ou, pior, de falso silencio.
--
-- Agora a verificacao NAO conhece a formula. Ela guarda o valor gravado, forca a
-- regeracao com um update que nao muda dado nenhum, e compara. O que a coluna
-- produzir hoje tem de ser igual ao que esta la.
create temp table _gerado_antes as
  select id, normalized_address, address_hash from public.establishment_addresses;

update public.establishment_addresses set cep = cep;

select is_empty(
  $$ select a.id
       from public.establishment_addresses a
       join _gerado_antes b on b.id = a.id
      where a.normalized_address is distinct from b.normalized_address
         or a.address_hash       is distinct from b.address_hash $$,
  'nenhum valor gravado diverge do que a funcao atual produz'
);

-- A verificacao acima, sozinha, NAO TEM DENTES sobre as proprias fixtures: elas
-- foram inseridas nesta transacao, com a funcao corrente, entao gravado e
-- recalculo coincidem por construcao. Provar que ela acusa exige criar a deriva.
--
-- Guarda a definicao, adultera a funcao, confirma que a verificacao encontra a
-- linha, e restaura. Tudo dentro da transacao que o rollback descarta.
create temp table _fn_original as
  select pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalize_address';

create or replace function public.normalize_address(p_raw text, p_cep text default null)
returns text language plpgsql immutable set search_path = '' as $adulterada$
begin return 'REGRA-DIVERGENTE'; end;
$adulterada$;

update public.establishment_addresses set cep = cep;

select isnt_empty(
  $$ select a.id
       from public.establishment_addresses a
       join _gerado_antes b on b.id = a.id
      where a.normalized_address is distinct from b.normalized_address $$,
  'a verificacao ACUSA quando a funcao muda: o valor regerado difere do gravado'
);

do $restaura$
declare v_def text;
begin
  select def into v_def from _fn_original;
  execute v_def;
end
$restaura$;

update public.establishment_addresses set cep = cep;

select is_empty(
  $$ select a.id
       from public.establishment_addresses a
       join _gerado_antes b on b.id = a.id
      where a.normalized_address is distinct from b.normalized_address $$,
  'restaurada a funcao, a divergencia desaparece: era a funcao, nao o dado'
);

select * from finish();
rollback;
