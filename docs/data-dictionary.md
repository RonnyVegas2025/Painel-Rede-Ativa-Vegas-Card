# Dicionário de dados — Sprint 0

Convenções: `id uuid default gen_random_uuid()` · `created_at`/`updated_at timestamptz
not null default now()` · RLS habilitada na criação de toda tabela.

## Enums

| Enum | Valores |
|---|---|
| `user_role` | `gestor_master` `administrativo` `supervisor_rede` `consultor_campo` `suporte_tecnico` `comercial` `consulta` |
| `eligibility_mode` | `all` `allowlist` `denylist` |
| `segment_rule_type` | `allow` `deny` |
| `registration_status` | `ativo` `bloqueado` `cancelado` `em_analise` |
| `transaction_status` | `recente` `atencao` `acao_necessaria` `critico` `nunca_transacionou` |
| `operational_status` | `apto` `problema_tecnico` `fechado_temporariamente` `encerrado` `mudanca_proprietario` `mudanca_endereco` `equipamento_indisponivel` `bloqueio_solicitado` `suspenso` `em_reativacao` |
| `visit_status` | `reservada` `em_deslocamento` `checkin_realizado` `em_atendimento` `concluida` `cancelada` `expirada` |
| `occurrence_status` | `aberta` `em_analise` `aguardando_informacao` `aprovada` `rejeitada` `resolvida` `cancelada` |

`visit_status` não contém `disponivel` — ver `status-flows.md`.

## teams

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | not null, unique |
| `supervisor_id` | uuid | FK `profiles(id)`, deferrable |
| `is_active` | boolean | default true |

## profiles

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | FK `auth.users(id)` on delete cascade |
| `full_name` | text | not null |
| `email` | citext | not null, unique |
| `role` | `user_role` | not null, default `consulta` |
| `team_id` | uuid | FK `teams(id)` |
| `phone` | text | |
| `is_active` | boolean | default true |

`profiles.team_id` e `teams.supervisor_id` formam ciclo: as FKs são adicionadas depois das
duas tabelas, e a de `teams` é `deferrable initially deferred` para permitir o seed.

Papel novo entra como `consulta`, o mais restrito. Promoção é ato explícito e auditado.
Trigger em `auth.users` cria o `profiles` correspondente.

## card_products

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | not null, unique — "Farmácia" |
| `slug` | text | not null, unique — `farmacia` |
| `eligibility_mode` | `eligibility_mode` | not null, default `allowlist` |
| `description` | text | |
| `display_order` | smallint | |
| `is_active` | boolean | default true |

Seed: Alimentação, Combustível, Farmácia, Refeição (`allowlist`); Vegas Day, Plus (`all`).

## segments

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `source_name` | text | not null, unique — valor cru da coluna `Subgrupo` |
| `normalized_name` | text | not null |
| `category` | text | `alimentacao` `combustivel` `farmacia` `refeicao` `servicos` `outros` |
| `cnae_hint` | text | |
| `is_active` | boolean | default true |

`source_name` preserva o valor original da planilha — é a chave de reconciliação na próxima
importação. `normalized_name` é o rótulo humano.

## product_segments

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `card_product_id` | uuid | FK, not null, on delete cascade |
| `segment_id` | uuid | FK, not null, on delete cascade |
| `rule_type` | `segment_rule_type` | not null |
| `created_by` | uuid | FK `profiles(id)` |

**`unique (card_product_id, segment_id)`** — sem `rule_type` na chave. É isso que torna
`allow` e `deny` simultâneos impossíveis por construção, em vez de depender de validação na
aplicação. Ver ADR 0003.

## system_settings

| Coluna | Tipo | Notas |
|---|---|---|
| `key` | text PK | |
| `value` | jsonb | not null |
| `value_type` | text | `integer` `decimal` `boolean` `string` |
| `unit` | text | `dias` `minutos` `metros` `segundos` |
| `min_value` / `max_value` | numeric | faixa aceita |
| `description` | text | not null — aparece em `/configuracoes` |
| `min_role` | `user_role` | not null, default `gestor_master` |
| `updated_by` | uuid | FK `profiles(id)` |

Seed:

| Chave | Valor | Unidade | `min_role` |
|---|---|---|---|
| `transaction_recent_days` | 30 | dias | `gestor_master` |
| `transaction_attention_days` | 60 | dias | `gestor_master` |
| `transaction_action_days` | 90 | dias | `gestor_master` |
| `visit_reservation_minutes` | 60 | minutos | `administrativo` |
| `checkin_radius_meters` | 200 | metros | `administrativo` |
| `consultant_location_update_seconds` | 60 | segundos | `administrativo` |
| `maximum_active_reservations` | 3 | — | `administrativo` |

Constraint garante coerência entre as três faixas: recente < atenção < ação.

## audit_logs

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | bigint | generated always as identity |
| `occurred_at` | timestamptz | default now() |
| `actor_id` | uuid | FK `profiles(id)`, nulo quando a origem é sistema |
| `actor_role` | `user_role` | papel no momento do ato |
| `action` | text | `insert` `update` `delete` `login` `custom` |
| `entity` | text | not null |
| `entity_id` | text | |
| `old_value` / `new_value` | jsonb | |
| `changed_fields` | text[] | preenchido no update |
| `origin` | text | `web` `import` `system` `edge_function` |
| `ip_address` | inet | **nulo** quando não obtido de forma confiável |
| `user_agent` | text | |
| `reason` | text | justificativa em exceções |

Índices: `(entity, entity_id)`, `(occurred_at desc)`, `(actor_id, occurred_at desc)`.

Sem `update`, sem `delete`, para nenhum papel. Inserção apenas pela função de trigger
`SECURITY DEFINER`.

`actor_role` é gravado por cópia, não por junção: o papel do usuário muda com o tempo, e o
log precisa registrar sob qual autoridade o ato foi praticado.
