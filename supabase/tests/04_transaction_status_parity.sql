-- Casos de paridade SQL x TypeScript (risco T1).
-- Os mesmos dias e limites do tests/parity/transaction-status-parity.test.ts.
begin;
select plan(12);

select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 0, 30, 60, 90),
  'recente'::public.transaction_status, '0 dias => recente');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 30, 30, 60, 90),
  'recente'::public.transaction_status, '30 dias => recente (borda)');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 31, 30, 60, 90),
  'atencao'::public.transaction_status, '31 dias => atencao');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 60, 30, 60, 90),
  'atencao'::public.transaction_status, '60 dias => atencao (borda)');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 61, 30, 60, 90),
  'acao_necessaria'::public.transaction_status, '61 dias => acao necessaria');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 90, 30, 60, 90),
  'acao_necessaria'::public.transaction_status, '90 dias => acao necessaria (borda)');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 91, 30, 60, 90),
  'critico'::public.transaction_status, '91 dias => critico');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 400, 30, 60, 90),
  'critico'::public.transaction_status, '400 dias => critico');
select is(public.calculate_transaction_status(null, 30, 60, 90),
  'nunca_transacionou'::public.transaction_status, 'nulo => nunca transacionou');

-- Limites diferentes mudam a classificacao do mesmo dado.
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 10, 7, 14, 21),
  'atencao'::public.transaction_status, '10 dias com limites 7/14/21 => atencao');
select is(public.calculate_transaction_status(
    (now() at time zone 'America/Sao_Paulo')::date - 10, 30, 60, 90),
  'recente'::public.transaction_status, '10 dias com limites 30/60/90 => recente');

-- Data futura nao vira critico.
select is(public.calculate_transaction_status(now() + interval '5 days', 30, 60, 90),
  'recente'::public.transaction_status, 'data futura => recente');

select * from finish();
rollback;
