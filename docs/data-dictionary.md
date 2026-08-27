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
| `status` | `capture_point_status` | seis valores — ver abaixo |
| `is_primary` | boolean | **unique parcial por estabelecimento** |

`capture_point_status` tem **seis** valores, conforme o complemento de escopo §11:
`ativo` `inativo` `em_homologacao` `com_erro` `substituido` `cancelado`. A migration
0017 criou apenas três e a 0021 completou — `com_erro` em particular é o estado que
a Sprint 7 usa para abrir atendimento a partir de ponto com problema, e adicionar
valor a enum depois da primeira importação deixa de ser barato.

A distinção que governa o índice não é "qual estado está em uso", e sim **qual
conjunto ocupa o número do terminal**:

| ocupam o número | liberam o número |
|---|---|
| `ativo` · `em_homologacao` · `com_erro` | `inativo` · `substituido` · `cancelado` |

Ponto `com_erro` continua alocado: o problema é do equipamento, não da alocação, e
liberar ali permitiria cadastrar um ponto novo com o mesmo terminal enquanto o
atendimento do antigo corre.

**`unique (establishment_id) where is_primary`** e
**`unique (establishment_id, terminal_number) where status in ('ativo','em_homologacao','com_erro')`**.

Não há `is_active` nesta tabela, de propósito: `status` já é a verdade, e um
booleano ao lado seria a mesma informação por dois caminhos, livre para divergir —
o mesmo problema de `never_transacted`, mas sem distinção semântica que o
justifique. As demais tabelas mantêm `is_active`, onde ele é a única dimensão.

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

---

# Sprint 1 — o que as etapas E-005 a E-008 acrescentaram

## Colunas de `establishments` acrescentadas pela leitura da base real

| Coluna | Tipo | Notas |
|---|---|---|
| `acquisition_channel` | text | coluna `Captação` — **como o comércio foi credenciado** (Pessoalmente, E-Mail, Telefone, Site, Licitação). Não confundir com meio de captura de transação, que é `capture_methods` e vem da coluna `Terminal` |
| `assigned_consultants_raw` | text | coluna `Consultores`, crua |
| `absent_since` | timestamptz | desde quando o registro deixou de vir no arquivo, dentro do escopo declarado |
| `absent_from_import` | uuid | FK `import_jobs`, qual importação marcou |

`assigned_consultants_raw` **não é vinculado a `profiles`**, e isso é decisão, não pendência:
dos 28 valores distintos, o mais frequente — `Vegas Card do Brasil`, em 808 das 1.804 linhas
— é a empresa, não uma pessoa. Casar nome por aproximação erra atribuição, e aqui a
atribuição decide quem visita o quê. A conciliação explícita fica para a Sprint 3, como fila,
igual à de segmentos.

Não existe coluna "voltou a aparecer". Reaparecer no arquivo seguinte limpa `absent_since`, e
a trilha registra as duas transições. Guardar histórico de ausência numa coluna seria inventar
uma tabela de histórico pela metade — a tabela de verdade é `absence_resolutions`.

`establishments_ausentes on (absent_since) where absent_since is not null` — a fila
administrativa é sempre uma fração da base.

## Ciclo da importação

### Enum `import_job_status`

`previa` · `aplicando` · `concluida` · `cancelada` · `falhou`

O commit exige `previa` e muda para `aplicando` **na mesma transação**. É isso que torna
confirmar duas vezes inofensivo: a segunda chamada encontra estado diferente e não
reprocessa. Idempotência pelo estado que já pertence ao modelo, em vez de um identificador
que o cliente precisa carregar.

`processando` é o estado da montagem da prévia, anterior a `previa` — ver as RPCs do ciclo
em `architecture.md`.

### Colunas acrescentadas a `import_jobs`

| Coluna | Tipo | Notas |
|---|---|---|
| `status` | `import_job_status` | not null, default `previa` |
| `duplicated_capture_methods` | integer | linhas cujo campo `Terminal` repetia o mesmo meio — `CIELO / CIELO`. São 9 na base atual |
| `addresses_without_number` | integer | endereços com `N.º: 0`. São 61 |
| `error_message` | text | |
| `derivado_de_id` | uuid | FK `import_jobs` — aponta para a importação descartada que originou esta, quando o operador redeclara o escopo |

Os dois contadores são **defeito da origem, não conflito**: não bloqueiam nada. Contá-los é o
que impede que deduplicar em silêncio faça o dado errado voltar em toda importação sem
ninguém notar.

`derivado_de_id` responde depois a pergunta que alguém vai fazer em março: "por que esta
importação existe?". Sem o elo, a redeclaração de escopo apaga a própria história.

### `import_rows` — imutabilidade

`import_row_status`: `novo` · `atualizado` · `inalterado` · `conflito` · `erro` · `ausente`.

A tabela tem trigger `before update` (`fn_import_rows_imutavel`) que permite **um único**
campo mudar: `establishment_id`, e apenas de nulo para valor. `raw_data`, `status` e
`line_number` não mudam nunca.

A garantia anterior era "o commit é o único escritor" — o que descreve o comportamento atual,
não uma garantia. A linha crua é evidência do que o arquivo trazia; evidência que a aplicação
pode reescrever não é evidência.

`establishment_id` é preenchido pelo commit também quando a linha **cria** o estabelecimento,
não só quando o identifica. Sem isso, todo registro recém-criado apareceria como ausente na
própria importação que o criou.

## absence_resolutions

### Enum `absence_resolution`

| Valor | Semântica | Efeito no operacional |
|---|---|---|
| `voltou_a_operar` | reaparecerá na próxima importação, ou já foi verificado por telefone | nenhum |
| `escopo_incorreto` | o arquivo era um recorte | nenhum |
| `nao_opera_mais` | não opera mais | `fechado_temporariamente` |

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `establishment_id` | uuid | FK, on delete cascade |
| `resolution` | `absence_resolution` | not null |
| `reason` | text | not null, `check (btrim(reason) <> '')` |
| `was_absent_since` | timestamptz | **cópia** de `absent_since` no momento da resolução |
| `absent_from_import` | uuid | FK `import_jobs` |
| `resolved_by` | uuid | FK `profiles` |
| `resolved_at` | timestamptz | default now() |

`was_absent_since` é cópia de propósito: resolver limpa `absent_since`, e sem a cópia a
pergunta "quanto tempo ficou na fila" deixaria de ter resposta no dia seguinte.

Leitura e escrita apenas para `is_admin()`. Sem `update`, sem `delete`, com trigger de
imutabilidade — decisão registrada não se reescreve.

A RPC `resolve_absences` **não recebe status por parâmetro**. `nao_opera_mais` grava
`fechado_temporariamente`; não existe argumento pelo qual pedir `encerrado`. A garantia é
estrutural, não documental — ver `status-flows.md`.

## Índices da listagem (migration 0045)

| Índice | Para |
|---|---|
| `establishments_recencia (last_transaction_at desc nulls last) where is_active` | ordenação e faixa transacional |
| `establishments_nunca_transacionou` | o filtro `nunca_transacionou`, que é `is null` e não faixa |
| `establishments_operacional` · `establishments_cadastral` · `establishments_segmento` | filtros da tela |
| `establishment_addresses_cidade_corrente` | filtro por cidade sobre o endereço corrente |

Filtrar por status transacional **não computa o status de todas as linhas para depois
filtrar**: a regra é invertida em intervalo de datas (`intervaloDeRecencia`) e o banco usa o
índice. A busca textual por nome continua sendo `ilike '%x%'` e **não** é resolvida por esses
índices — está registrada como dívida em `architecture.md`.
