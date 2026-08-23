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
