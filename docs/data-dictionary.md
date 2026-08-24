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


---

# Sprint 1 — estabelecimentos e importação

## capture_methods

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `source_name` | text | not null, unique — valor cru da coluna `Captação` |
| `name` | text | not null — rótulo humano |
| `is_active` | boolean | default true |

**Nasce vazia.** Semear com nomes escolhidos à mão criaria o mesmo defeito de
reconciliação que `source_name` existe para evitar em `segments`: se a planilha
grafar `STONE PAGAMENTOS`, o seed cria um registro e o importador cria outro. Quem
popula é o importador, pelos valores distintos de `Captação`.

Entrou na Sprint 1, e não na 6 como previa o roadmap, porque
`establishment_capture_points` a referencia e o dado chega na importação. FK
nascendo nula obrigaria a Sprint 6 a re-derivar o vínculo a partir de
`import_rows`, com a base já em uso.

## establishments

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `external_contract` | text | identidade prioritária; **unique parcial** quando não nulo |
| `cnpj` | text | 14 dígitos por check; indexado; **nunca chave única** (ADR 0001) |
| `legal_name` · `trade_name` | text | not null |
| `segment_id` | uuid | FK `segments` |
| `registration_status` | enum | `ativo` `bloqueado` `cancelado` `em_analise` |
| `operational_status` | enum | dez estados |
| `relationship_start_date` | date | coluna `Data de Cadastro`. **Não é `created_at`** |
| `last_transaction_at` | timestamptz | |
| `never_transacted` | boolean | ver constraint abaixo |
| `is_active` | boolean | default true |

**`check (not never_transacted or last_transaction_at is null)`** — a redundância
entre a flag e o nulo é proposital: nulo pode significar "nunca transacionou" ou
"não informado", e a planilha distingue com o texto `Nunca Transacionou`.
Redundância sem constraint diverge.

## establishment_addresses

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `establishment_id` | uuid | FK, on delete cascade |
| `street` · `city` · `state` | text | not null — bruto, preservado intocado |
| `cep` | text | 8 dígitos por check |
| `normalized_address` | text | **gerada pelo banco** por `normalize_address` |
| `address_hash` | text | **gerada** — md5 do normalizado |
| `latitude` · `longitude` | double precision | populadas na Sprint 2 |
| `is_current` | boolean | **unique parcial por estabelecimento** |

As duas colunas geradas não aceitam escrita. O ADR 0001 exige persistir a
normalização; persistir e deixar a aplicação gravar são coisas diferentes — um
defeito no importador escreveria hash divergente, e hash divergente só se corrige
com migração de dados. A gêmea TypeScript continua existindo para o importador
casar linha **antes** de gravar; o valor gravado não depende dela.

**`unique (establishment_id) where is_current`** — sem isto, "mudou de endereço"
deixa dois correntes e o check-in por raio da Sprint 3 usa coordenada arbitrária.

## establishment_capture_points

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `establishment_id` | uuid | FK, on delete cascade |
| `capture_method_id` | uuid | FK `capture_methods`; nula até o importador reconciliar |
| `terminal_number` | text | not null |
| `status` | `capture_point_status` | `ativo` `inativo` `substituido` |
| `is_primary` | boolean | **unique parcial por estabelecimento** |

**`unique (establishment_id) where is_primary`** e
**`unique (establishment_id, terminal_number) where status = 'ativo'`**.

O segundo é **provisório** e vive em migration própria (0020): a chave definitiva
depende de medição no arquivo real. Se o mesmo terminal aparecer em
estabelecimentos diferentes, passa a ser `(capture_method_id, terminal_number)`.

É parcial porque `substituido` existe: equipamento trocado deixa o ponto antigo
como histórico, e ponto histórico não pode bloquear o novo.

## import_jobs

Escopo, contadores e a trava de ausentes. Detalhe e rationale no **ADR 0011**.

## import_rows

| Coluna | Tipo | Notas |
|---|---|---|
| `import_id` | uuid | FK, on delete cascade |
| `line_number` | integer | unique com `import_id` |
| `status` | `import_row_status` | seis estados, espelha `ImportRowStatus` |
| `raw_data` | jsonb | linha crua — dado de terceiro |
| `establishment_id` | uuid | FK, nula quando a linha não casou |

Leitura restrita a quem executa importação: `raw_data` guarda telefone, e-mail e
razão social de terceiros. **Sem policy de escrita** — a linha crua é evidência do
que o arquivo trazia, não dado editável.
