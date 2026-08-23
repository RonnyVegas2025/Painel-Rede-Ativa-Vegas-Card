begin;
select plan(8);

-- Unicidade sem rule_type: e o que torna a contradicao impossivel (ADR 0003) ----
select col_is_unique('public', 'product_segments', array['card_product_id','segment_id'],
  'product_segments unico por (produto, segmento), SEM rule_type');

-- Prova pratica: mesmo par com allow e deny tem de falhar.
insert into public.card_products (name, slug, eligibility_mode)
  values ('Teste pgTAP', 'teste-pgtap', 'allowlist');
insert into public.segments (source_name, normalized_name, category)
  values ('TESTE PGTAP', 'Teste pgTAP', 'outros');

select lives_ok($$
  insert into public.product_segments (card_product_id, segment_id, rule_type)
  select p.id, s.id, 'allow'
  from public.card_products p, public.segments s
  where p.slug = 'teste-pgtap' and s.source_name = 'TESTE PGTAP'
$$, 'primeira regra entra');

select throws_ok($$
  insert into public.product_segments (card_product_id, segment_id, rule_type)
  select p.id, s.id, 'deny'
  from public.card_products p, public.segments s
  where p.slug = 'teste-pgtap' and s.source_name = 'TESTE PGTAP'
$$, '23505', null, 'regra contraditoria e recusada pelo banco');

-- Parametros dentro da faixa ----------------------------------------------------
select throws_ok($$
  update public.system_settings set value = '0'::jsonb where key = 'checkin_radius_meters'
$$, null, null, 'raio abaixo do minimo e recusado');

select throws_ok($$
  update public.system_settings set value = '99999'::jsonb where key = 'visit_reservation_minutes'
$$, null, null, 'reserva acima do maximo e recusada');

-- Ordem das faixas de recencia --------------------------------------------------
select throws_ok($$
  update public.system_settings set value = '90'::jsonb where key = 'transaction_recent_days'
$$, null, null, 'recente maior que atencao e recusado');

select lives_ok($$
  update public.system_settings set value = '25'::jsonb where key = 'transaction_recent_days'
$$, 'alteracao coerente e aceita');

-- Classificacao em SQL ----------------------------------------------------------
select is(
  public.calculate_transaction_status(null, 30, 60, 90),
  'nunca_transacionou'::public.transaction_status,
  'data nula classifica como nunca transacionou'
);

select * from finish();
rollback;
