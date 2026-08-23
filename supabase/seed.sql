-- Seed de desenvolvimento. Nao roda em producao.

-- pgTAP: necessario para `supabase test db`. Fica aqui e nao em migration,
-- porque seed so roda localmente e framework de teste nao vai para producao.
create extension if not exists pgtap with schema extensions;

-- Parametros operacionais -----------------------------------------------------
insert into public.system_settings (key, value, value_type, unit, min_value, max_value, description, min_role) values
  ('transaction_recent_days',  '30'::jsonb, 'integer', 'dias',     1,   365,
   'Ate quantos dias sem transacao o estabelecimento e classificado como recente.', 'gestor_master'),
  ('transaction_attention_days','60'::jsonb, 'integer', 'dias',     1,   730,
   'Limite superior da faixa de atencao.', 'gestor_master'),
  ('transaction_action_days',  '90'::jsonb, 'integer', 'dias',     1,  1095,
   'Limite superior da faixa de acao necessaria. Acima disso, critico.', 'gestor_master'),
  ('visit_reservation_minutes','60'::jsonb, 'integer', 'minutos',  5,   480,
   'Tempo de validade da reserva antes de expirar automaticamente.', 'administrativo'),
  ('checkin_radius_meters',   '200'::jsonb, 'integer', 'metros',  20,  2000,
   'Distancia maxima entre consultor e estabelecimento para check-in sem excecao.', 'administrativo'),
  ('consultant_location_update_seconds','60'::jsonb,'integer','segundos',15,600,
   'Intervalo de amostragem da posicao do consultor durante acao ativa.', 'administrativo'),
  ('maximum_active_reservations','3'::jsonb,'integer', null,       1,    20,
   'Quantas reservas ativas um consultor pode manter ao mesmo tempo.', 'administrativo')
on conflict (key) do nothing;

-- Modalidades -----------------------------------------------------------------
insert into public.card_products (name, slug, eligibility_mode, description, display_order) values
  ('Alimentação', 'alimentacao', 'allowlist', 'Segmentos de alimentação.',                1),
  ('Refeição',    'refeicao',    'allowlist', 'Restaurantes, padarias e conveniências.',  2),
  ('Combustível', 'combustivel', 'allowlist', 'Somente postos de combustíveis.',          3),
  ('Farmácia',    'farmacia',    'allowlist', 'Farmácias e drogarias.',                   4),
  ('Vegas Day',   'vegas-day',   'all',       'Todos os estabelecimentos credenciados.',  5),
  ('Plus',        'plus',        'all',       'Todos os estabelecimentos credenciados.',  6)
on conflict (slug) do nothing;

-- Segmentos iniciais.
-- source_name imita o valor cru da coluna Subgrupo. A lista definitiva sai da
-- planilha real na Sprint 1; isto e so o suficiente para o seed e os testes.
insert into public.segments (source_name, normalized_name, category) values
  ('SUPERMERCADO',         'Supermercado',          'alimentacao'),
  ('MERCEARIA',            'Mercearia',             'alimentacao'),
  ('ACOUGUE',              'Açougue',               'alimentacao'),
  ('HORTIFRUTI',           'Hortifrúti',            'alimentacao'),
  ('PADARIA',              'Padaria',               'refeicao'),
  ('RESTAURANTE',          'Restaurante',           'refeicao'),
  ('LANCHONETE',           'Lanchonete',            'refeicao'),
  ('CONVENIENCIA',         'Loja de conveniência',  'refeicao'),
  ('POSTO DE COMBUSTIVEL', 'Posto de combustível',  'combustivel'),
  ('FARMACIA',             'Farmácia',              'farmacia'),
  ('DROGARIA',             'Drogaria',              'farmacia'),
  ('VESTUARIO',            'Vestuário',             'outros'),
  ('MATERIAL DE CONSTRUCAO','Material de construção','outros')
on conflict (source_name) do nothing;

-- Elegibilidade ---------------------------------------------------------------
-- Vegas Day e Plus sao 'all': nao recebem linha nenhuma, de proposito.
insert into public.product_segments (card_product_id, segment_id, rule_type)
select p.id, s.id, 'allow'
from public.card_products p
join public.segments s on (
     (p.slug = 'alimentacao' and s.category in ('alimentacao','refeicao'))
  or (p.slug = 'refeicao'    and s.category = 'refeicao')
  or (p.slug = 'combustivel' and s.category = 'combustivel')
  or (p.slug = 'farmacia'    and s.category = 'farmacia')
)
on conflict (card_product_id, segment_id) do nothing;

-- Equipe de exemplo -----------------------------------------------------------
insert into public.teams (name) values ('Rede São Paulo - Capital')
on conflict (name) do nothing;

-- Usuarios de teste: criar pelo Studio ou pela CLI e depois promover, ex.:
--   update public.profiles set role = 'gestor_master' where email = 'gestor@vegas.local';
-- Lembrete do ADR 0005: o papel novo so vale no proximo token. Encerrar a sessao.
