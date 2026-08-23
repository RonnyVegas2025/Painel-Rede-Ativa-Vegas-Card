# ADR 0002 — Exclusividade de visita

- **Status:** aceito
- **Data:** 2026-07-31

## Contexto
Duas ações simultâneas (Farmácia e Vegas Day, mesma cidade) podem alcançar o mesmo ponto
credenciado. Se a exclusividade fosse por `(establishment_id, action_id)`, dois consultores
apareceriam na mesma loja no mesmo dia — exatamente o desperdício que o sistema existe para
evitar, e um constrangimento diante do lojista.

## Decisão
**Exclusividade global por `establishment_id`.**

Uma visita atende N ações: `visits` 1—N `visit_actions`. Ao reservar, o sistema já vincula
todas as ações ativas para as quais aquele ponto é elegível. O consultor faz o teste de
Farmácia, o de Vegas Day, a adesivação e a atualização cadastral numa ida só.

Garantia em três camadas:

1. **Advisory lock** por estabelecimento, dentro da RPC:
   `perform pg_advisory_xact_lock(hashtextextended(establishment_id::text, 0))`
   Serializa as tentativas concorrentes no mesmo ponto sem travar a tabela.

2. **Expiração preguiçosa**, na mesma transação, antes da inserção: reservas vencidas passam
   a `expirada`. Sem isso, o índice do item 3 bloquearia por causa de linha morta.

3. **Índice único parcial**, a garantia final:

```sql
create unique index visits_um_ativo_por_estabelecimento
  on visits (establishment_id)
  where status in ('reservada','em_deslocamento','checkin_realizado','em_atendimento')
    and override_reason is null;
```

`pg_cron` roda a expiração periodicamente apenas como rede de segurança, não como mecanismo
principal — reserva vencida precisa liberar no instante em que alguém tenta reservar.

### Exceção do supervisor
O índice ignora linhas com `override_reason not null`. É assim que a exceção prevista se
torna possível sem enfraquecer a regra: quem não justifica não passa pelo índice, ponto.
`override_reason` é `not null` sempre que `override_by` estiver preenchido, e a criação
grava em `audit_logs` com `reason`.

## Alternativas consideradas
- **Exclusividade por ação.** Descartada por decisão de negócio de 31/07.
- **`select ... for update` no estabelecimento.** Funciona, mas prende a linha do
  estabelecimento para qualquer outra escrita concorrente. O advisory lock é mais estreito.
- **Serializable isolation.** Custo alto e erros de serialização a tratar em todo o app,
  para um problema que o índice parcial resolve localmente.
- **Só o índice, sem lock.** Funciona, mas todo perdedor de corrida recebe
  `unique_violation` e precisa de tradução para mensagem útil. O lock transforma a corrida
  numa fila e devolve "já reservado por Fulano, restam 34 min".

## Consequências
- `visits` não tem `action_id`. Consulta por ação passa por `visit_actions`.
- O painel da ação conta visitas via junção — indexar `visit_actions (field_action_id, visit_id)`.
- Concluir a visita conclui para todas as ações vinculadas. Se uma ação precisar de resultado
  próprio, isso vive em `visit_actions`, não em `visits`.
- O teste pgTAP de duas reservas concorrentes é obrigatório e não pode ser marcado como skip.
