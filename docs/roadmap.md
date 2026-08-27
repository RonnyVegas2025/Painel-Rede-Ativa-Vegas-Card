# Roadmap — Painel Rede Vegas Ativa

Atualizado em 03/08/2026, após o complemento da Central Operacional.

## Situação

| Sprint | Estado |
|---|---|
| 0 — Fundação | **concluída**, aguardando validação no ambiente real |
| 1 — Estabelecimentos e importação | **concluída** (E-001 a E-009); V13–V15 de Storage pendentes de validação humana |
| 2 a 11 | planejadas |

O que a Sprint 1 deixou implementado está em `docs/architecture.md`; as pendências
registradas, em `CLAUDE.md` §17.

## Sequência

```
0 ──► 1 ──► 2 ──► 3 ──► 4 ──► 5 ──────────────────► 11
      │                                             ▲
      └──► 6 ──► 7 ──────────────► 9 ──► 10 ────────┘
           │                       ▲
           └── 8 (bloqueada) ──────┘
```

| # | Sprint | Entrega | Depende de | Bloqueio |
|---|---|---|---|---|
| 0 | Fundação | estrutura, banco, auth, RLS, parâmetros, testes | — | — |
| 1 | Estabelecimentos | importação, identidade, pontos de captura | 0 | — |
| 2 | Classificação e mapa | recência, geocodificação, mapa filtrado | 1 | **provedor (ADR 0006)** |
| 3 | Ações e reservas | ação, equipe, reserva atômica, check-in | 1, 2 | — |
| 4 | Visita | checklist, teste, adesivação, evidências | 3 | — |
| 5 | Ocorrências | ocorrência, solicitação e decisão de bloqueio | 4 | — |
| 6 | Meios de captura | cadastro, contatos, indicadores | 1 | — |
| 7 | Atendimentos | tickets, categorias, histórico, SLA | 6 | janela de cobertura do SLA |
| 8 | Métricas transacionais | ingestão, consolidação horária e diária | — | **origem dos dados (ADR 0016)** |
| 9 | Alertas | regras, motor, fila, reconhecimento | 7, 8 | linha de base (ADR 0017) |
| 10 | Central de monitoramento | painel de parede, modo ampliado | 9 | — |
| 11 | Indicadores e refinamento | relatórios, auditoria, ajustes | tudo | — |

## E-008 — o que foi construído, e a decisão que ele fechou

**Resolução de ausentes**, em `/importacoes`. O ADR 0011 mandava o registro ausente
para análise administrativa; o E-005 marcava com data, o E-006 mostrava o número, e
não havia onde a análise acontecesse. Sem ação a marca nunca saía.

### A decisão: ausência **não** grava `encerrado`

A pergunta era se "confirmar encerramento" deveria gravar
`operational_status = encerrado`. O projeto já tinha respondido em dois lugares que
ninguém havia cruzado:

- `src/constants/operational-status.ts`, primeira linha: *"Dimensão operacional:
  **confirmada em campo**."*
- `docs/status-flows.md`: *"`encerrado` é definitivo e confirmado"* · *"`fechado_temporariamente`
  não é `encerrado`. Confundir os dois derruba comércio ativo."*

Ausência numa planilha não é confirmação em campo — é evidência mais fraca que o
consultor na porta, e pode ser troca de adquirente, recorte de exportação ou
arquivo filtrado. Então o caminho administrativo grava `fechado_temporariamente`, e
**só a visita confirma `encerrado`**. O diagrama de `status-flows.md` já previa a
transição `fechado_temporariamente → encerrado`; faltava notar que a origem
administrativa entra na primeira.

A garantia é **estrutural**: `resolve_absences` não recebe status por parâmetro.
Não há como pedir `encerrado` a ela porque o argumento não existe.

### A assimetria das três decisões

| Decisão | Efeito | Atrito |
|---|---|---|
| "O arquivo era um recorte" | desmarca | lote livre — é o caso mais provável quando há centenas |
| "Continua operando" | desmarca | lote livre |
| "Não opera mais" | `fechado_temporariamente` | por item, nenhum; **em lote, digitar a quantidade** |

Desmarcar é reversível; mudar a dimensão operacional de centenas de uma vez não
deveria ser um clique. Por item não há atrito — atrito em todo lugar é atrito em
lugar nenhum.

`absence_resolutions` guarda a decisão, o motivo, quem decidiu e **desde quando
estava ausente** — copiado, porque `absent_since` é limpo pela resolução e sem isso
"quanto tempo ficou na fila" deixaria de ter resposta no dia seguinte. Imutável por
trigger, não por ausência de policy.

**Histórico de importações** concluídas e descartadas, com o motivo do descarte e a
marca de confirmação acima do limiar.

### O que continua fora, de propósito

**Expurgo automático de prévia abandonada.** Prévia abandonada com meses é
informação sobre tentativas estranhas, e apagar sozinho o que ninguém olhou perde o
rastro. O descarte manual com motivo já existe.

**Relatório exportável por estado.** Sprint 6, junto dos indicadores.

## Bloqueios abertos

**Provedor de mapa e geocodificação** — Google descartado; avaliação entre Mapbox e
MapLibre/OSM. Trava a sprint 2. O código está desacoplado por
`lib/maps/geocoding-provider.ts`, então a escolha troca uma implementação.

**Origem dos dados transacionais** — as métricas exigem transação a transação ou
agregado por hora, com histórico. A planilha só traz uma data de última transação, e
não há como derivar o resto. Trava a sprint 8, e por consequência a 9 e a 10. Não trava
as sprints 6 e 7.

**Janela de cobertura do SLA** — "primeira resposta em 15 minutos" e "1 dia útil" não
são calculáveis sem horário de atendimento e calendário. Trava o cálculo de prazo na
sprint 7, não o resto do módulo.

## Racional da ordem

**Campo antes de central.** As sprints 1 a 5 entregam o produto original completo. A
central é acréscimo valioso, não substituição.

**Meios de captura antes de atendimento.** O ticket se liga ao ponto de captura;
cadastro depois deixaria o vínculo nulo para sempre.

**Atendimento antes de alerta.** Atendimento manual tem valor sozinho — a equipe já
atende por telefone e WhatsApp sem registro nenhum. Alerta sem atendimento é uma lista
sem destino.

**Métricas em paralelo.** A sprint 8 não depende de visita nem de ticket. Definida a
origem dos dados, pode correr junto com a 6 e a 7.

## Visão de longo prazo — quatro pilares

O roadmap de sprints entrega os dois primeiros pilares. Os dois últimos são evolução
prevista do produto, sem data e sem escopo fechado. Ficam registrados para que a
arquitetura não feche portas.

### 1. Operação de campo — sprints 1 a 5
Mapa, visitas, reservas, check-in, ocorrências e bloqueios. É o produto original.

### 2. Central de atendimento — sprints 6 a 10
Suporte ao estabelecimento, protocolo, SLA, meios de captura e acompanhamento das
tratativas. Alertas e monitoramento entram aqui quando a origem transacional existir.

### 3. Inteligência da rede — futuro
Módulo analítico: segmentos com mais problemas, cidades com menor cobertura, meios de
captura com mais falhas, taxa de recuperação, produtividade da equipe, qualidade da
rede.

### 4. Inteligência comercial — futuro
Apoio à expansão: cobertura por cidade e modalidade, oportunidades de credenciamento,
regiões descobertas, potencial por segmento.

**Uma dependência a registrar desde já:** "oportunidades de credenciamento" e "regiões
descobertas" exigem saber quais comércios **não** estão na rede. Isso não existe em
nenhuma base do projeto — é a mesma classe de bloqueio da origem transacional, e vai
precisar de fonte externa (dados públicos de CNPJ por CNAE e município, ou base
comercial contratada). O que o sistema consegue responder sozinho é cobertura relativa:
onde há rede densa e onde há rede rala. A lacuna absoluta depende de dado de fora.

## O que sustenta os pilares 3 e 4

Analítica não se retroage. O único erro irreversível é **não registrar o que aconteceu
quando aconteceu** — dado não capturado hoje não se reconstrói depois.

Três disciplinas que já estão em vigor e precisam continuar:

- **Transição de estado sempre com carimbo de tempo.** "Taxa de recuperação de
  estabelecimentos" só é calculável se existir o registro de quando cada um parou e de
  quando voltou. Estado atual sem histórico responde "como está", nunca "como chegou
  aqui".
- **`audit_logs` e tabelas de histórico são somente-inserção.** Já garantido: nenhum
  papel tem `update` nem `delete`.
- **Nada de sobrescrever.** Mudança de endereço, de proprietário e de meio de captura
  preserva o anterior. É o que permite medir rotatividade depois.

Os módulos analíticos não devem consultar as tabelas operacionais diretamente quando
chegarem: leitura pesada de painel sobre tabela com RLS e escrita concorrente degrada a
operação de campo. O caminho é modelo de leitura próprio — view materializada ou
tabela de agregação — pelo mesmo raciocínio que motivou `transaction_daily_metrics`.
Não é decisão para agora; é a razão de manter a auditoria e o histórico limpos.

## Health Score — evolução prevista

Pontuação por estabelecimento, calculada a partir de frequência transacional,
histórico, reincidência de problemas, volume de atendimentos, ocorrências, visitas,
meio de captura e estabilidade operacional. Uso previsto: priorização automática de
visita, atendimento e expansão.

**Depende da origem transacional** — sem frequência e histórico, o índice mede apenas
suporte, e um comércio saudável que nunca deu trabalho pontuaria igual a um comércio
morto.

Quatro princípios de desenho, para quando chegar a hora:

1. **Derivado, nunca gravado como verdade.** Mesmo princípio de `transaction_status`,
   de `disponivel` e de `sla_state`: pontuação depende de pesos configuráveis, e peso
   que muda torna a coluna gravada uma mentira silenciosa. Instantâneos periódicos para
   ver tendência, sim; fonte de verdade, não.
2. **Pesos parametrizáveis**, em tabela, com auditoria. Peso em constante no código
   torna a fórmula inauditável.
3. **Explicável.** Um número de 0 a 100 sozinho não sustenta decisão: a tela precisa
   mostrar o que puxou a nota para baixo. Score opaco é ignorado ou obedecido cegamente,
   e os dois são ruins.
4. **Priorização sugerida, não automática.** Score define ordem de sugestão; quem
   decide a rota continua sendo o supervisor. Automatizar a decisão antes de saber se a
   fórmula acerta é como confiar num alerta antes de medir o falso positivo.

## Regra de trabalho

Planejar → implementar → testar → reportar bugs → corrigir → documentar → concluir.
Nenhuma sprint começa sem a anterior validada no ambiente real.
