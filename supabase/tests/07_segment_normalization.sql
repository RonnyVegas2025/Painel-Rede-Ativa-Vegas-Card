-- Fila de normalizacao de segmentos: alias canonico, revisao e impacto.
--
-- A fila e entregavel, nao extra (ADR 0003). A falha fechada faz segmento nao
-- mapeado sumir das modalidades restritas: sem tela para resolver, comercio
-- legitimo fica invisivel e ninguem sabe por que.

begin;
select plan(12);

-- Um usuario, para `reviewed_by`. profiles.id referencia auth.users, e o perfil
-- nasce da trigger fn_handle_new_user — inserir em auth.users e o caminho real.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'revisor@vegas.local',
        '{"full_name":"Revisor de Teste"}'::jsonb);

-- Modalidade em allowlist para exercitar a resolucao pelo canonico.
insert into public.card_products (id, name, slug, eligibility_mode)
values ('cccccccc-0000-4000-8000-000000000001', 'Teste Allowlist', 'teste-allowlist', 'allowlist');

insert into public.segments (id, source_name, normalized_name, category)
values ('dddddddd-0000-4000-8000-000000000001', 'TESTE PADARIA', 'Padaria', 'alimentacao');

-- ===========================================================================
-- Alias: um nivel, garantido pelo banco
-- ===========================================================================

select lives_ok(
  $$ insert into public.segments (id, source_name, normalized_name, category, canonical_segment_id)
     values ('dddddddd-0000-4000-8000-000000000002', 'TESTE PADARIA E CONFEITARIA',
             'Padaria e Confeitaria', 'alimentacao', 'dddddddd-0000-4000-8000-000000000001') $$,
  'alias de um segmento canonico e aceito'
);

-- Sem isto a resolucao viraria recursao e alguem criaria ciclo.
select throws_ok(
  $$ insert into public.segments (source_name, normalized_name, category, canonical_segment_id)
     values ('TESTE PANIFICADORA', 'Panificadora', 'alimentacao',
             'dddddddd-0000-4000-8000-000000000002') $$,
  23503,
  null,
  'alias apontando para outro alias e recusado: um nivel so'
);

select throws_ok(
  $$ update public.segments
        set canonical_segment_id = id
      where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  23514,
  null,
  'segmento apontando para si mesmo e recusado'
);

-- Promover o canonico a alias quebraria a FK de quem aponta para ele. O banco
-- recusa, o que e o comportamento desejado: nao da para puxar o tapete.
insert into public.segments (id, source_name, normalized_name, category)
values ('dddddddd-0000-4000-8000-000000000003', 'TESTE MERCEARIA', 'Mercearia', 'alimentacao');

select throws_ok(
  $$ update public.segments
        set canonical_segment_id = 'dddddddd-0000-4000-8000-000000000003'
      where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  23503,
  null,
  'canonico com aliases apontando para ele nao pode virar alias'
);

-- O alias mantem o proprio source_name: e o que faz a importacao seguinte casar
-- por reconciliacao em vez de recriar a duplicata e reabrir o item da fila.
select is(
  (select source_name from public.segments where id = 'dddddddd-0000-4000-8000-000000000002'),
  'TESTE PADARIA E CONFEITARIA',
  'o alias preserva o source_name: a reconciliacao da importacao continua casando'
);

-- ===========================================================================
-- Elegibilidade pelo canonico
-- ===========================================================================

insert into public.product_segments (card_product_id, segment_id, rule_type)
values ('cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', 'allow');

select bag_eq(
  $$ select segment_id from public.eligible_segments('cccccccc-0000-4000-8000-000000000001') $$,
  $$ values ('dddddddd-0000-4000-8000-000000000001'::uuid),
            ('dddddddd-0000-4000-8000-000000000002'::uuid) $$,
  'estabelecimento vinculado ao alias entra pela modalidade do canonico'
);

-- Desativar o canonico derruba o alias junto: alias nao volta a ser elegivel
-- sozinho.
select is(
  (select count(*)::int from (
     select public.eligible_segments('cccccccc-0000-4000-8000-000000000001')
   ) t),
  2,
  'antes de desativar, os dois estao elegiveis'
);

-- ===========================================================================
-- Revisao: o que tira o item da fila
-- ===========================================================================

select throws_ok(
  $$ update public.segments set reviewed_at = now()
      where id = 'dddddddd-0000-4000-8000-000000000003' $$,
  23514,
  null,
  'revisao exige quem e quando juntos'
);

select isnt_empty(
  $$ select id from public.segment_normalization_queue
      where id = 'dddddddd-0000-4000-8000-000000000003' $$,
  'segmento sem revisao aparece na fila'
);

-- "Confirmar como esta" e acao legitima, e provavelmente a mais frequente. Sem
-- ela, um segmento que legitimamente e `outros` voltaria a fila a cada abertura
-- da tela, e duas semanas depois ninguem olharia mais.
update public.segments
   set reviewed_at = now(),
       reviewed_by = 'eeeeeeee-0000-4000-8000-000000000001'
 where id = 'dddddddd-0000-4000-8000-000000000003';

select is_empty(
  $$ select id from public.segment_normalization_queue
      where id = 'dddddddd-0000-4000-8000-000000000003' $$,
  'segmento revisado sai da fila e nao volta'
);

-- ===========================================================================
-- A fila e de prioridade: o numero e quantos estabelecimentos estao escondidos
-- ===========================================================================

insert into public.establishments (external_contract, legal_name, trade_name, segment_id)
values ('C-F1', 'Um', 'Um',   'dddddddd-0000-4000-8000-000000000002'),
       ('C-F2', 'Dois', 'Dois', 'dddddddd-0000-4000-8000-000000000002');

select is(
  (select establishments_hidden::int from public.segment_normalization_queue
    where id = 'dddddddd-0000-4000-8000-000000000002'),
  2,
  'a fila conta quantos estabelecimentos cada pendencia esconde'
);

-- ===========================================================================
-- Auditoria: a mudanca de alias e a decisao mais consequente da tela
-- ===========================================================================
-- Ela move estabelecimentos entre modalidades sem tocar em `establishments`.
-- Se nao aparecer na trilha, ninguem consegue reconstruir por que a
-- elegibilidade mudou.

update public.segments
   set canonical_segment_id = 'dddddddd-0000-4000-8000-000000000001'
 where id = 'dddddddd-0000-4000-8000-000000000003';

-- Ordena por `id`, e nao por `occurred_at`: o default e `now()`, que e constante
-- dentro da transacao, entao todas as linhas escritas aqui compartilham o mesmo
-- instante e a ordenacao por tempo nao distingue o insert do update. `id` e
-- sequencial e e o unico criterio deterministico dentro de uma transacao.
select ok(
  (select 'canonical_segment_id' = any(changed_fields)
     from public.audit_logs
    where entity = 'segments'
      and entity_id = 'dddddddd-0000-4000-8000-000000000003'
      and action = 'update'
    order by id desc
    limit 1),
  'canonical_segment_id aparece em changed_fields: a mudanca de alias fica na trilha'
);

select * from finish();
rollback;
