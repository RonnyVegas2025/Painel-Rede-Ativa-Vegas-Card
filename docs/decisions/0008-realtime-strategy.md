# ADR 0008 — Estratégia de Realtime

- **Status:** aceito
- **Data:** 2026-08-02

## Contexto
O mapa precisa mostrar reserva de outro consultor no instante em que acontece — é assim que
a duplicidade é evitada antes de virar erro. O supervisor precisa ver a equipe se movendo.

O caminho óbvio é `postgres_changes` em `visits` e `consultant_locations`. Ele tem um custo
que só aparece com escala: as policies de RLS são avaliadas **por evento e por assinante**.
Com 20 consultores em campo e posição a cada 60 segundos, são 1.200 eventos por hora, cada
um multiplicado pelo número de assinantes, cada combinação passando por avaliação de policy.
O gargalo não é a rede, é o banco.

## Decisão
**Broadcast a partir de trigger** como mecanismo principal. `postgres_changes` fica apenas
onde o volume é baixo e a conveniência compensa.

| Evento | Mecanismo | Canal |
|---|---|---|
| Reserva criada, transferida, cancelada, expirada | Broadcast por trigger | `acao:{action_id}` |
| Visita muda de estado | Broadcast por trigger | `acao:{action_id}` |
| Ocorrência urgente aberta | Broadcast por trigger | `acao:{action_id}` e `supervisao:{team_id}` |
| Posição do consultor | Broadcast **do cliente**, sem gravar toda vez | `equipe:{team_id}` |
| Decisão de bloqueio | `postgres_changes` | tabela `block_requests` |
| Parâmetro alterado | `postgres_changes` | tabela `system_settings` |

A autorização acontece **uma vez, na entrada do canal**, via RLS em
`realtime.messages` — não a cada mensagem. É essa inversão que faz a coisa escalar.

### Posição do consultor — decisão específica
Gravar cada ping em `consultant_locations` significa 1.200 linhas por hora por equipe, para
um dado cuja utilidade dura segundos. A decisão:

- O ping vai por Broadcast direto, sem passar pelo banco. O supervisor vê o movimento.
- A **persistência** é amostrada: uma linha a cada `consultant_location_update_seconds`, ou
  quando o deslocamento passa de um limiar, ou nos eventos que importam para auditoria
  (check-in, início de atendimento, exceção de raio).
- O que se guarda é a trilha auditável, não a telemetria contínua.

Isso também é o desenho correto para a LGPD: menos dado retido, com finalidade clara.

### Payload
O evento carrega o mínimo: `establishment_id`, `visit_id`, `status`, `consultant_id`,
`expires_at`. **Nunca** carrega ficha completa, telefone, observação interna ou foto. Quem
recebe o evento e tem permissão busca o resto pela API, onde a RLS decide de novo.

Isso importa porque o canal é por ação, e nem todo participante de uma ação tem o mesmo
nível de acesso ao detalhe.

### Garantias
Broadcast é *best-effort*, não entrega garantida. O cliente **sempre** revalida ao
reconectar, ao voltar do background e a cada 90 segundos como piso. O Realtime acelera a
convergência; ele não é a fonte de verdade. A fonte de verdade é o índice único do ADR 0002 —
o mapa mostrando "disponível" nunca autoriza nada, quem autoriza é a RPC.

## Alternativas consideradas
- **`postgres_changes` em tudo.** Descartada pelo custo de avaliação de RLS por evento e por
  assinante. Funciona no piloto, degrada em produção, e a degradação aparece justamente no
  pico de uso.
- **Polling.** Descartada para reserva: a janela de corrida entre dois consultores é de
  segundos.
- **Persistir toda posição.** Descartada: volume alto, valor baixo, exposição de dado pessoal
  desproporcional.

## Consequências
- Cada trigger de Broadcast é código a manter, e o payload precisa ser versionado — cliente
  antigo recebendo campo novo não pode quebrar.
- Canal por ação exige que o cliente reassine ao trocar de ação.
- A revalidação periódica precisa existir desde a primeira versão, senão a interface diverge
  em silêncio quando um evento se perde.
- Implementação na Sprint 3. A decisão é agora porque define o desenho dos triggers e da
  amostragem de `consultant_locations`, que é tabela da Sprint 3.
