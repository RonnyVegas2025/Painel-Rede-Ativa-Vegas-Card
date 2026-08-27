# Critérios de aceite

Cada critério do `CLAUDE.md` seção 15, com onde está verificado.

| # | Critério | Verificação | Sprint |
|---|---|---|---|
| 1 | Farmácia não exibe postos | `tests/unit/product-eligibility.test.ts` · pgTAP `01` · guia V4 | 0 |
| 2 | Vegas Day e Plus aceitam todos os segmentos ativos | mesmo conjunto | 0 |
| 3 | Duas visitas ativas no mesmo ponto são impossíveis | `visit-reservation.test.ts` (regra) · pgTAP de concorrência | 3 |
| 4 | Reserva expirada volta a disponível | `visit-reservation.test.ts` · RPC de expiração preguiçosa | 3 |
| 5 | Resultado crítico gera ocorrência | trigger em `visits` | 5 |
| 6 | Importação não duplica | hash de endereço congelado em `normalize.test.ts` | 1 |
| 7 | Suspenso e bloqueado saem das listas de aptos | `marker-status.test.ts` | 2 |
| 8 | Mudanças críticas têm auditoria | `fn_audit` · guia V9 | 0 |

## Verificado na Sprint 0

- Falha fechada na elegibilidade: segmento não mapeado nunca aparece em modalidade restrita
- `disponivel` ausente do enum `visit_status`
- `unique(card_product_id, segment_id)` sem `rule_type`: contradição rejeitada pelo banco
- Nenhuma policy `FOR ALL`
- `audit_logs` sem policy de escrita para papel nenhum
- Consultor não altera parâmetro nem se promove
- Papel vem do claim do JWT, com queda para `consulta` na ausência
- Toda função `SECURITY DEFINER` fixa `search_path`
- Classificação por recência em Sao_Paulo, com paridade SQL × TypeScript

---

## Sprint 1 — estabelecimentos e importação

Os critérios da seção 15 do `CLAUDE.md` que a Sprint 1 tocava, e o que passou a verificá-los.

| Critério | Onde está verificado |
|---|---|
| Importação não duplica | hash de endereço congelado em `tests/unit/normalize.test.ts`; paridade SQL × TS em `tests/parity-db/address-hash-input.parity.test.ts`; segunda passada real no `npm run ensaio`, que exige zero criados |
| Registro ausente nunca é excluído | pgTAP `09_import_commit.sql` e `12_resolucao_de_ausentes.sql`; nenhuma policy de DELETE em `establishments` (pgTAP `05`) |
| Mudanças críticas têm auditoria | `fn_audit` com origem `import` marcada pelo commit; pgTAP `05`; guia V9 |
| Suspenso e bloqueado saem das listas de aptos | `tests/unit/marker-status.test.ts` (regra); a listagem da Sprint 1 filtra por dimensão separada |

### Garantias que a Sprint 1 acrescentou, e onde falhariam

Cada linha abaixo foi verificada por **injeção**: o defeito foi introduzido e o teste ficou
vermelho. Garantia que nunca se viu falhar não é garantia.

| Garantia | Verificação | O que quebra se cair |
|---|---|---|
| Confirmar duas vezes não importa duas vezes | pgTAP `09` — segunda chamada devolve o resultado anterior | base duplicada, sem sinal |
| Só gestão executa o commit | pgTAP `09`, assumindo `consultor_campo`, espera `42501` | consultor cria estabelecimento |
| A prévia escreve com o cliente do usuário, sob RLS | pgTAP `10`; a aplicação não tem cliente `service_role` no caminho | RLS deixa de ser fronteira no único caminho que escreve em massa |
| Prévia só escreve no próprio job, em `processando` | pgTAP `10` — policy com `uploaded_by = auth.uid()` e status | um job contamina o outro |
| Sequência de linhas conferida sem confiar no cliente | pgTAP `10` — `min = 2`, `n = max - 1` | arquivo truncado passa como completo |
| O commit **recontam** ausentes; não lê `requires_confirmation` | pgTAP `09` | a trava confia em quem ela deveria vigiar |
| Ausente tem uma definição só | `import_absent_establishments` usada pela tela, pela contagem e pela marcação | tela e commit discordam sobre quem sumiu |
| Reaparecer limpa a marca | pgTAP `09` — segunda importação com o registro de volta | fila administrativa cresce com quem já voltou |
| `import_rows` é imutável exceto pelo elo | pgTAP `11` — `update` em `raw_data` e em `status` recusado | evidência reescrita pela aplicação |
| Redeclarar escopo não descarta antes de a cópia existir | pgTAP `11` — duas fases, `import_finish_redeclaration` idempotente | operador fica sem nenhum dos dois jobs |
| Ausência nunca grava `encerrado` | pgTAP `12`; a RPC não tem parâmetro de status | baixa definitiva por erro de exportação |
| Resolução é imutável e exige motivo | pgTAP `12` — `update` recusado, motivo vazio recusado | decisão registrada reescrita |
| `anon` não executa função nenhuma em `public` | pgTAP `05` — contagem zero | o ambiente concede o que nenhuma migration escreveu |
| Nenhuma função de trigger é executável por papel de aplicação | pgTAP `05` | gravador de auditoria chamável à mão |
| Inventário de `SECURITY DEFINER` fechado | pgTAP `05`, com comentários removidos antes do casamento | `is_admin` num comentário satisfaz a asserção |
| Filtro transacional usa índice | `EXPLAIN ANALYZE` na 0045; `intervaloDeRecencia` inverte a regra em intervalo de datas | varredura completa a cada filtro |
| A regra invertida concorda com a direta | `tests/parity-db/intervalo-de-recencia.parity.test.ts`, por igualdade de conjuntos | duas fontes para a mesma faixa |
| Diretiva do Next não convive com export de valor | `tests/design/diretivas-do-next.test.ts` | módulo morto em execução, com build e typecheck verdes |
| Menu e rotas não divergem | `tests/design/nav-matches-routes.test.ts`, com cobertura por ancestral | rota sem porta de entrada |

### Ensaio

`ENSAIO_PLANILHA=/caminho/base.xlsx npm run ensaio -- --com-dados` exercita instalação
limpa, 47 migrations, criação de usuário, importação da base real pelas telas e a suíte
completa. Saída esperada: `══ ENSAIO OK ══`. Passo a passo em `docs/setup-validation.md` §2
— aqui não se repete, para não haver duas fontes para o mesmo fato.

Medições da última execução: 1804 estabelecimentos · 3577 pontos de captura · 13 meios ·
15 segmentos · 319 nunca transacionaram · 1 conflito · 0 erros · 9 duplicados de origem ·
61 endereços sem número · 1 objeto no bucket · `anon` com zero funções.

O ensaio encontrou defeito nas três execuções em que foi rodado. É o número que justifica
tê-lo escrito.
