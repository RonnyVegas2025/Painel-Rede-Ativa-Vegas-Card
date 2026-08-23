# Análise do complemento de escopo — Central Operacional

Documento de análise. Nada implementado, nada decidido: material para aprovação.

---

## 1. O que já estava previsto

Do complemento, uma parte pequena já estava no plano:

| Item | Situação |
|---|---|
| `incidents` e `block_requests` | previstos, Sprint 5 |
| Auditoria de mudanças críticas | **entregue** na Sprint 0 (`fn_audit`) |
| Realtime para reserva e visita | decidido no ADR 0008, Sprint 3 |
| Permissões por papel | matriz entregue, precisa de extensão |
| Parametrização sem número fixo | `system_settings` entregue |
| Terminal do estabelecimento | previsto como **coluna** da planilha |

O último item muda de natureza: `Terminal` deixa de ser atributo e vira tabela filha.

## 2. O que é novo

Cinco módulos que não existiam em nenhuma forma:

1. **Métricas transacionais** — consolidação horária e diária
2. **Alertas** — motor de regras sobre desvio de comportamento
3. **Atendimentos** — tickets com canal, SLA, protocolo e histórico
4. **Meios de captura** — cadastro, contatos e pontos por estabelecimento
5. **Central de monitoramento** — painel de parede com atualização automática

Isso não é um acréscimo ao projeto: é um segundo produto acoplado ao primeiro. O
sistema deixa de ser uma ferramenta de campo e passa a ser central de operações com
service desk embutido. A estimativa de esforço mais que dobra.

Vale dizer com clareza porque muda a conversa sobre prazo, não porque seja problema.

---

## 3. O bloqueio: a origem dos dados transacionais

**Os módulos 1 a 5 dependem de um dado que o sistema não possui e não pode derivar.**

Hoje existe uma coluna `Última Transação` na planilha — uma data, por estabelecimento,
atualizada quando alguém exporta a base. Os módulos novos exigem:

- contagem de transações por hora, por estabelecimento
- valor movimentado por hora
- aprovadas versus negadas
- histórico de semanas ou meses para formar linha de base

Nada disso se obtém da planilha. Nem com importação diária: uma data de última
transação não vira média histórica de 80 transações por dia.

**Antes de qualquer estimativa dos módulos 1 a 5, é preciso responder:**

| Pergunta | Por que decide o desenho |
|---|---|
| De onde vêm as transações? | API do adquirente, arquivo do processador, banco do sistema Vegas, ou os quatro |
| Com que atraso? | tempo real muda tudo; D+1 inviabiliza "sem transação há 3 horas" |
| Com que granularidade? | transação a transação, ou já agregado pela origem |
| Quem é o dono técnico? | quem mantém o contrato de dados quando ele mudar |
| Há histórico disponível? | sem 60 a 90 dias de histórico, não há linha de base no dia 1 |
| Estorno e cancelamento chegam? | métrica que só soma fica errada e ninguém percebe |

Se a resposta for "D+1, arquivo diário", o produto muda: não é monitoramento, é
relatório de acompanhamento. Alerta de "parou de transacionar há 3 horas" chegando no
dia seguinte não tem uso operacional. Ainda é útil — só é outra coisa.

**Recomendação:** documentar a origem em ADR próprio antes de qualquer sprint dos
módulos 1 a 5. Os módulos 6 a 11 (atendimentos e meios de captura) **não dependem
disso** e podem seguir em paralelo.

---

## 4. O problema estatístico da linha de base

O item 2 pede comparação com o histórico do próprio estabelecimento. A formulação
"média histórica" tem três falhas que produzem alarme falso em volume, e alarme falso
em volume mata a central: a equipe para de olhar o monitor em duas semanas.

### Sazonalidade semanal
Padaria faz 200 transações no sábado e 40 na segunda. Comparar segunda com a média
geral gera queda de 60% toda segunda-feira. **A linha de base tem que ser por dia da
semana e faixa de hora**, não uma média única.

### Feriado
Feriado nacional derruba a rede inteira. Feriado municipal derruba uma cidade —
Botucatu tem o seu, São Paulo tem o dela. A regra de "cidade com comportamento
anormal" dispara em todo feriado municipal do estado.

### A média é sensível a evento isolado
Um dia de promoção com 400 transações levanta a média e faz os dias normais parecerem
queda. **Mediana e percentis são mais estáveis que média** para esse uso.

### A saída: comparação relativa ao grupo
A correção mais eficaz é comparar o estabelecimento **com seus pares na mesma hora** —
mesmo segmento, mesma cidade, mesmo meio de captura.

Se a padaria caiu 70% e as padarias da cidade caíram 70%, é feriado ou chuva: não é
problema do lojista. Se a padaria caiu 70% e as vizinhas estão normais, é problema
dela.

Isso resolve feriado, clima e sazonalidade de uma vez, sem calendário. E converte a
maior fonte de alarme falso no sinal mais valioso do sistema: quando o grupo inteiro de
um adquirente cai junto, isso é falha do adquirente, que é exatamente o que o item 4
pede na regra de "quantidade anormal de estabelecimentos afetados pelo mesmo meio de
captura".

### Partida a frio
Estabelecimento novo, ou recém-credenciado, não tem histórico. O campo
`minimum_historical_volume` cobre parte: sem volume mínimo, a regra não avalia. Precisa
também de janela mínima de dias — sugestão de 14 — antes de qualquer alerta de desvio.

### Medir o próprio acerto
O status `descartado` é o dado mais importante do módulo: é a taxa de falso positivo
por regra. Deve ser painel visível, e regra com descarte acima de um limiar deve ser
sinalizada para revisão. Sem isso, ninguém sabe se a central funciona.

---

## 5. Impacto no modelo de domínio

O modelo do ADR 0009 ganha um eixo inteiro. Hoje o sistema gira em torno de
**visita**; passa a ter dois centros: **visita** (campo) e **atendimento** (remoto).

```
        MÉTRICA                    MEIO DE CAPTURA
        ───────                    ───────────────
transaction_hourly_metrics         capture_methods
transaction_daily_metrics            │  └── capture_method_contacts
        │  agregado por hora         │
        │                            ▼
        ▼                   establishment_capture_points
    alert_rules  ──────►      (N por estabelecimento)
        │  avalia                    │
        ▼                            │
  transaction_alerts ────────────────┤
        │  um ativo por              │
        │  (estabelecimento, regra)  │
        ▼                            ▼
   support_tickets ◄─────────── PONTO CREDENCIADO
     protocolo, SLA, canal            │
        │  ├── history                │
        │  ├── comments               │
        │  └── attachments            │
        │                             │
        ├──────► visits ──────────────┤   atendimento pede visita
        └──────► incidents ───────────┘   atendimento vira ocorrência
```

### A fronteira entre atendimento e ocorrência

É o ponto de confusão mais provável, e precisa estar escrito antes de alguém modelar:

- **Atendimento** é a interação. Tem canal, protocolo, responsável, SLA e conversa.
  Responde "quem está resolvendo isto e desde quando".
- **Ocorrência** é a constatação sobre o estabelecimento que exige decisão
  administrativa. Responde "o que foi decidido sobre este comércio".

Um atendimento pode nascer e morrer sem ocorrência (dúvida operacional resolvida por
telefone). Uma ocorrência sempre nasce de uma constatação — de visita ou de
atendimento. **Bloqueio continua saindo só de ocorrência**, nunca direto do
atendimento: a separação entre quem observa e quem decide não pode ser contornada pelo
caminho novo.

### Impacto no ADR 0001 (identidade)

A identidade do ponto credenciado **não muda**: continua sendo o contrato externo. Mas
`Terminal`, que era coluna, vira `establishment_capture_points`. Isso afeta a Sprint 1:
a importação passa a popular duas tabelas, e um estabelecimento com dois terminais
deixa de ser ambíguo.

Restrição necessária: **um único `is_primary` por estabelecimento**, por índice único
parcial — o mesmo padrão do ADR 0002.

---

## 6. Novas tabelas

Treze confirmadas, três a avaliar.

| Tabela | Observação |
|---|---|
| `capture_methods` | cadastro; poucos registros, muda pouco |
| `capture_method_contacts` | N por método, com `priority_order` |
| `establishment_capture_points` | **um `is_primary` por estabelecimento** (índice parcial) |
| `support_ticket_categories` | parametrizável, com SLA por categoria |
| `support_tickets` | `protocol_number` sequencial e legível, não uuid |
| `support_ticket_history` | trilha de estado; distinta de `audit_logs` |
| `support_ticket_comments` | interno versus visível |
| `support_ticket_attachments` | Storage privado, mesmo padrão de visita |
| `alert_rules` | critérios tipados; `configuration_json` só complementar |
| `transaction_alerts` | **um ativo por (establishment, rule)** — índice parcial |
| `alert_history` | transições |
| `transaction_hourly_metrics` | particionada por mês |
| `transaction_daily_metrics` | retenção longa |

**A avaliar:**
- `support_ticket_assignments` — só se houver necessidade de histórico de fila. Se o
  responsável atual basta, `assigned_user_id` mais `support_ticket_history` resolvem.
- `support_ticket_links` — necessária. Um atendimento se liga a visita, ocorrência,
  alerta e outro atendimento. Sem tabela de vínculo, viram cinco colunas nulas.
- `service_level_rules` — necessária. SLA por prioridade **e** categoria não cabe em
  `system_settings`.
- **`holiday_calendar`** — não pedida, mas necessária se a comparação relativa a pares
  não for adotada. Com pares, dispensável.

### Chave natural das métricas

`unique (establishment_id, card_product_id, metric_date, metric_hour)`.

A ingestão precisa ser **upsert idempotente**, não contador incremental. Transação
atrasada, estorno e reprocessamento são rotina; contador incremental fica errado em
silêncio e ninguém descobre. A métrica tem que ser recalculável a partir da origem.

### Volume

1.804 estabelecimentos × 24 horas × 365 dias ≈ **15,8 milhões de linhas por ano** na
tabela horária. O Postgres aguenta, mas:

- particionar por mês desde o início — particionar depois exige migração com dados
- retenção curta na horária (90 a 180 dias), longa na diária
- `metric_date` e `metric_hour` em **America/Sao_Paulo**, não em UTC, ou o dia civil
  quebra e a agregação diária mistura dias

Se a rede crescer para 20 mil pontos, são 175 milhões por ano. A partição deixa de ser
higiene e vira requisito.

---

## 7. Novos enums

| Enum | Valores |
|---|---|
| `priority_level` | `critica` `alta` `media` `baixa` |
| `alert_status` | `novo` `em_analise` `atendimento_aberto` `aguardando_retorno` `resolvido` `descartado` |
| `alert_rule_type` | `inatividade` `queda_percentual` `ausencia_total` `reincidencia` `anomalia_captura` `anomalia_regiao` |
| `ticket_status` | `aberto` `em_triagem` `em_atendimento` `aguardando_comercio` `aguardando_meio_captura` `aguardando_visita` `aguardando_area_interna` `resolvido` `encerrado_sem_solucao` `cancelado` |
| `ticket_channel` | `telefone` `whatsapp` `email` `contato_interno` `monitoramento` `alerta` `comercial` `adquirente` `visita` `outro` |
| `capture_type` | `pos` `tef` `softpos` `aplicativo` `ecommerce` `integracao_propria` `outro` |
| `capture_point_status` | `ativo` `inativo` `em_homologacao` `com_erro` `substituido` `cancelado` |
| `sla_state` | derivado, **não gravado** — ver seção 9 |

**Uma prioridade só, compartilhada por alerta e atendimento.** Dois enums com os mesmos
quatro valores divergiriam na primeira mudança.

### Estados ativos, para os índices parciais

- Alerta ativo: `novo`, `em_analise`, `atendimento_aberto`, `aguardando_retorno`
- Atendimento aberto: tudo menos `resolvido`, `encerrado_sem_solucao`, `cancelado`

---

## 8. Impacto nas permissões

A matriz ganha cerca de 18 permissões. As mudanças que alteram o desenho:

| Permissão | GM | ADM | SUP | CON | SUP.T | COM | CSL |
|---|---|---|---|---|---|---|---|
| `atendimentos.abrir` | — | ✓ | ✓ | — | ✓ | — | — |
| `atendimentos.assumir` | — | ✓ | ✓ | — | ✓ | — | — |
| `atendimentos.distribuir` | ✓ | — | ✓ | — | — | — | — |
| `atendimentos.encerrar` | — | ✓ | ✓ | **—** | ✓ | — | — |
| `atendimentos.registrar_campo` | — | — | ✓ | ✓ | — | — | — |
| `alertas.reconhecer` | — | ✓ | ✓ | — | ✓ | — | — |
| `alertas.descartar` | — | ✓ | ✓ | — | — | — | — |
| `alertas.configurar_regras` | ✓ | — | — | — | — | — | — |
| `meios_captura.gerenciar` | ✓ | ✓ | — | — | — | — | — |
| `sla.configurar` | ✓ | — | — | — | — | — | — |
| `monitoramento.ver_painel` | ✓ | ✓ | ✓ | — | ✓ | — | ✓ |

Três observações:

**O consultor não encerra atendimento.** O complemento é explícito, e a regra é a
mesma da Sprint 0: quem está no campo registra o que fez; quem tem visão do processo
decide se acabou. O consultor grava diagnóstico e evidência; o atendimento continua
aberto se depende de adquirente ou área interna.

**O gestor master não executa atendimento.** Confirma o que já achamos na Sprint 0:
`gestor_master` administra, não executa. Nova evidência de que o desenho está coerente.

**O comercial não entra em nada disso.** `COMERCIAL_FORBIDDEN` cresce: diagnóstico,
comentário interno, contato do lojista e evidência de atendimento entram na lista.

### RLS que precisa de cuidado

`support_tickets` é a mais delicada até agora: o consultor lê apenas os atendimentos
ligados a visitas dele; o suporte técnico apenas os de categoria técnica; o comercial
nenhum. São três recortes diferentes na mesma tabela, e cada um precisa de teste pgTAP
com o papel assumido.

---

## 9. Arquitetura proposta

### Módulos

```
src/features/
├── monitoramento/          painel de parede
├── alertas/                regras, fila, reconhecimento
├── atendimentos/           tickets, histórico, comentários
├── meios-de-captura/       cadastro, contatos, indicadores
├── metricas-transacionais/ ingestão e consulta
└── sla/                    cálculo e estados de prazo
```

Padrão já aprovado: `components/ services/ hooks/ validations/ types/ utils/`.

### Regras puras novas

```
src/lib/business-rules/
├── calculate-alert-priority.ts     desvio → prioridade
├── evaluate-alert-rule.ts          regra + métricas → dispara ou não
├── calculate-baseline.ts           mediana por dia da semana e hora
├── calculate-sla-state.ts          prazo + pausas → estado
└── resolve-ticket-transition.ts    transição válida de status
```

Mesma disciplina: não leem banco, recebem parâmetros por argumento.

### SLA — o ponto que exige modelagem, não só um campo

O item 17 pede "pausado por dependência externa". Isso quebra `due_at` como
timestamp único: se o relógio para enquanto se aguarda o adquirente, o prazo final
depende de quanto tempo ficou parado.

Modelo necessário:

- `due_at` como prazo **corrente**, recalculado quando a pausa termina
- `paused_total_seconds` acumulado
- `paused_at` para a pausa em curso
- transição para estado `aguardando_*` inicia pausa; saída encerra e acumula

**`sla_state` é derivado, nunca gravado.** "Próximo do vencimento" muda sozinho com a
passagem do tempo: gravado, ficaria obsoleto entre uma escrita e outra. Mesmo princípio
de `transaction_status` e de `disponivel`.

**Pergunta em aberto que precisa de resposta antes da implementação:** SLA de 15
minutos para crítica vale 24 horas por dia? Se o suporte atende das 8h às 18h, um
alerta das 2h da manhã nasce vencido e o indicador fica sem sentido. É preciso definir
janela de cobertura e calendário de dias úteis, senão "1 dia útil" não é calculável.

### Motor de alertas

Edge Function acionada por `pg_cron`, mesmo padrão do ADR 0006. Avalia regras ativas
contra as métricas do período e insere alertas.

Deduplicação pelo mesmo padrão do ADR 0002 — índice único parcial:

```sql
create unique index alerta_unico_ativo
  on transaction_alerts (establishment_id, alert_rule_id)
  where status in ('novo','em_analise','atendimento_aberto','aguardando_retorno');
```

O padrão da reserva de visita se reaproveita inteiro. Custo: regras × estabelecimentos
por execução — precisa ter teto e medição desde a primeira versão.

### Central de monitoramento

Rota fora do grupo `(dashboard)`, sem menu lateral, para o modo ampliado.

Quatro problemas práticos de painel que fica ligado o dia todo:

1. **Sessão.** O JWT expira em 1 hora. Um monitor aberto desde segunda precisa de
   renovação silenciosa funcionando, ou aparece a tela de login na parede.
2. **Reconexão.** Queda de rede não pode deixar o painel mostrando dado velho como se
   fosse atual. Relógio de última atualização em destaque e indicador visível de dado
   desatualizado.
3. **Degradação.** Realtime falhando cai para busca periódica, conforme ADR 0008.
4. **Legibilidade a distância.** Painel de parede é lido a 3 metros. Tipografia e
   contraste diferentes do resto do sistema; a rampa de status continua valendo, e a
   restrição de não comunicar só por cor vale ainda mais aqui.

---

## 10. Divisão por sprints

A Sprint 0 está concluída e não é tocada. As sprints 1 a 5 seguem como aprovado.

| Sprint | Conteúdo | Depende de |
|---|---|---|
| 1 | Estabelecimentos e importação **+ pontos de captura** | — |
| 2 | Classificação, geocodificação, mapa | provedor (ADR 0006) |
| 3 | Ações, equipe, reserva atômica, check-in | 1, 2 |
| 4 | Visita, checklist, evidências | 3 |
| 5 | Ocorrências e bloqueio | 4 |
| **6** | **Meios de captura**: cadastro, contatos, indicadores | 1 |
| **7** | **Atendimentos**: tickets, histórico, categorias, SLA | 6 |
| **8** | **Métricas transacionais**: ingestão e consolidação | **origem dos dados** |
| **9** | **Alertas**: regras, motor, fila | 7, 8 |
| **10** | **Central de monitoramento** | 9 |
| 11 | Indicadores, auditoria, refinamento | tudo |

Três decisões de ordenação, com o porquê:

**Meios de captura antes de atendimento.** O ticket se liga ao ponto de captura. Sem o
cadastro, o vínculo nasce nulo e nunca é preenchido depois.

**Atendimento antes de alerta.** Atendimento manual tem valor sozinho: a equipe já
atende por telefone e WhatsApp hoje, sem registro nenhum. Entregar isso primeiro dá
retorno imediato e não depende da integração transacional. Alerta sem atendimento é
uma lista que ninguém sabe o que fazer com.

**Métricas podem correr em paralelo a partir da 6.** Não dependem de visita nem de
ticket. Assim que a origem dos dados estiver definida, a sprint 8 pode andar junto com
a 6 e a 7, se houver gente.

**A sprint 8 está bloqueada** enquanto a origem dos dados não for documentada. As
sprints 6 e 7 não estão.

---

## 11. Riscos técnicos

| # | Risco | Gravidade | Mitigação |
|---|---|---|---|
| N1 | **Origem dos dados transacionais indefinida** | **bloqueante** | ADR antes da sprint 8 |
| N2 | Alarme falso por sazonalidade e feriado | alta | comparação relativa a pares; mediana |
| N3 | Fadiga de alerta esvazia a central | alta | medir descarte por regra; teto de alertas |
| N4 | Volume da tabela horária | média | partição mensal desde o início; retenção |
| N5 | Ingestão não idempotente | alta | upsert por chave natural; recalculável |
| N6 | SLA sem janela de cobertura definida | média | definir horário e calendário antes da 7 |
| N7 | Sessão expirando no painel de parede | média | renovação silenciosa; teste de 24 h |
| N8 | Fronteira atendimento × ocorrência confusa | média | documentar antes de modelar |
| N9 | Custo do motor de alertas | média | teto por execução; medir desde a v1 |
| N10 | Fuso nas métricas | alta | `metric_date` e `metric_hour` em SP |
| N11 | Protocolo legível e não adivinhável | baixa | sequência com prefixo, não uuid |
| N12 | RLS de `support_tickets` com três recortes | média | pgTAP por papel, obrigatório |

**Sobre N11:** o protocolo é dito ao telefone. Precisa ser curto e legível — algo como
`AT-2026-000123`. Sequência, não uuid. Contrapartida: sequência revela volume de
atendimentos a quem observar, o que é aceitável aqui.

---

## 12. Critérios de aceite

**Meios de captura**
- Um estabelecimento com dois terminais aparece com dois pontos de captura
- Só existe um `is_primary` por estabelecimento, garantido por índice
- Desativar meio de captura não apaga histórico de atendimento

**Atendimentos**
- Protocolo único, sequencial e legível
- Consultor não encerra atendimento com pendência externa
- Atendimento aguardando adquirente pausa o SLA
- Toda mudança de status entra em histórico e auditoria
- Comercial não acessa nenhum atendimento

**Alertas**
- Não existe segundo alerta ativo para o mesmo estabelecimento e regra
- Estabelecimento com menos de 14 dias de histórico não gera alerta de desvio
- Queda simultânea em toda a cidade não gera alerta individual por lojista
- Descarte por regra é visível e medido

**Métricas**
- Reprocessar o mesmo período não duplica linha
- Estorno reduz o valor consolidado
- Dia civil respeita America/Sao_Paulo

**Central**
- Painel aberto por 24 horas continua atualizando, sem tela de login
- Realtime caído mostra aviso de dado desatualizado, não dado velho como atual
- Nenhum indicador comunica só por cor

---

## 13. Arquivos a criar ou alterar

**Alterar:** `CLAUDE.md` · `docs/architecture.md` · `docs/data-dictionary.md` ·
`docs/permissions.md` · `docs/status-flows.md` · `docs/business-rules.md` ·
`docs/acceptance-tests.md` · `docs/decisions/0009-domain-model.md` ·
`setup-estrutura.sh` (6 módulos novos) · `src/lib/permissions/matrix.ts`

**Criar agora:** `docs/roadmap.md`

**ADRs — os seis pedidos, mais dois que a análise mostrou necessários:**

| ADR | Assunto |
|---|---|
| 0010 | Monitoramento transacional |
| 0011 | Ciclo de vida do atendimento |
| 0012 | Modelo de meios de captura |
| 0013 | Prioridade de alerta |
| 0014 | Agregação de métricas |
| 0015 | Gestão de nível de serviço |
| **0016** | **Origem dos dados transacionais** — bloqueia a sprint 8 |
| **0017** | **Linha de base e comparação relativa a pares** — decide N2 e N3 |

Os dois últimos não estavam na lista. O 0016 é o bloqueio da seção 3; o 0017 é a
decisão estatística da seção 4. Ambos determinam desenho de tabela, não só
implementação — por isso são ADR e não detalhe de sprint.

**Migrations e código:** nada agora. A Sprint 0 permanece intocada, e as sprints 6 a 10
só entram depois da aprovação desta análise e da conclusão das sprints anteriores.
