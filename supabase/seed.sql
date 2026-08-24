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
-- ===========================================================================
-- segments e product_segments NAO sao semeados. Deliberadamente.
-- ===========================================================================
-- O seed anterior trazia 13 segmentos escolhidos a mao — SUPERMERCADO, PADARIA,
-- FARMACIA — e derivava 15 regras de elegibilidade deles.
--
-- A medicao da base real mostrou intersecao ZERO com esses 13. Os valores reais
-- de `Subgrupo` sao frases descritivas, com os erros da origem:
--
--   Comercio Verejista - Supermercados                  826 linhas  (typo: "Verejista")
--   Comercio varejista de produtos farmaceutico         594 linhas  (sem o `s`)
--   Restaurantes e outros estabelecimentos de servicos  148 linhas
--
-- Manter o seed produziria duas populacoes convivendo: 13 segmentos orfaos que
-- nunca casam com nada, mais os 15 reais criados pela importacao. E a disciplina
-- de `source_name` — valor cru como chave de reconciliacao — perderia o sentido
-- se o valor cru fosse escolhido por nos em vez de vir da origem.
--
-- A importacao popula. A fila de normalizacao em /segmentos mapeia os reais para
-- canonicos, e so entao as regras de elegibilidade sao criadas em /produtos,
-- contra segmentos que existem de fato.
--
-- Consequencia operacional, que e a falha fechada do ADR 0003 funcionando como
-- desenhada: entre a primeira importacao e a resolucao da fila, NENHUM
-- estabelecimento e elegivel a Farmacia, Alimentacao, Refeicao ou Combustivel.
-- A fila deixa de ser preparacao e vira pre-requisito da primeira importacao.

-- Equipe de exemplo -----------------------------------------------------------
insert into public.teams (name) values ('Rede São Paulo - Capital')
on conflict (name) do nothing;

-- Usuarios de teste: criar pelo Studio ou pela CLI e depois promover, ex.:
--   update public.profiles set role = 'gestor_master' where email = 'gestor@vegas.local';
-- Lembrete do ADR 0005: o papel novo so vale no proximo token. Encerrar a sessao.
