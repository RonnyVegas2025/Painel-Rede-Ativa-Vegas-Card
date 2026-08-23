# Fluxos de status

Cinco dimensões independentes. Um estabelecimento tem um valor em cada uma, ao mesmo tempo.

## Cadastral — vem da base importada

`ativo` · `bloqueado` · `cancelado` · `em_analise`

Origem: planilha. Alterado por importação ou pelo administrativo. **Nunca** é prova de que o
comércio está funcionando — só de que o cadastro está regular.

## Transacional — calculado

`recente` (0–30) · `atencao` (31–60) · `acao_necessaria` (61–90) · `critico` (>90) ·
`nunca_transacionou` (`last_transaction_at is null`)

Limites em `system_settings`. Derivado, nunca digitado. Recalculado a cada consulta, não
armazenado — parâmetro que muda tornaria a coluna obsoleta em silêncio.

## Operacional — confirmado em campo

```
                    ┌──────────────────────────────┐
        apto ───────┤ visita registra o que achou  │
                    └──────────────────────────────┘
                       │        │         │       │
      problema_tecnico ┤        │         │       ├ mudanca_endereco
equipamento_indisponivel┤       │         │       ├ mudanca_proprietario
                        │       │         │       │
              fechado_temporariamente     │  bloqueio_solicitado
                        │                 │       │
                        │            encerrado    ▼
                        │           (definitivo)  suspenso ──► em_reativacao ──► apto
                        └──────────► em_reativacao ──────────┘
```

Distinções que não podem colapsar:
- `bloqueio_solicitado` é pedido pendente. O estabelecimento **continua operando** até a
  decisão do administrativo.
- `suspenso` sai das listas de aptos, mas é reversível.
- `encerrado` é definitivo e confirmado.
- `fechado_temporariamente` não é `encerrado`. Confundir os dois derruba comércio ativo.

Transição para `suspenso`, `encerrado` ou de volta para `apto` exige decisão administrativa
registrada em auditoria. O consultor nunca escreve esses três diretamente.

## Visita

```
(sem visita = disponível)
        │ reservar
        ▼
   reservada ──── expira (60 min) ────► expirada ──► volta a disponível
        │ ├─ supervisor cancela ──────► cancelada
        │ └─ supervisor transfere ────► reservada (outro consultor)
        ▼ iniciar deslocamento
 em_deslocamento
        ▼ check-in dentro do raio (ou exceção justificada)
 checkin_realizado
        ▼ iniciar atendimento
  em_atendimento ── expiração não se aplica a partir do check-in
        ▼ concluir
    concluida
```

**`disponivel` não é valor do enum.** É a ausência de visita ativa, derivada em consulta.
Não existe linha em `visits` com esse status, e o enum não o contém — se contivesse, alguém
acabaria gravando e criando um estado fantasma que o índice de exclusividade não pega.

Estados que **bloqueiam** nova reserva: `reservada`, `em_deslocamento`, `checkin_realizado`,
`em_atendimento`.
Estados que **liberam**: `concluida`, `cancelada`, `expirada`.

Uma visita atende N ações via `visit_actions`. Reservar já cria os vínculos das ações
elegíveis para aquele ponto, para o consultor resolver tudo numa ida só.

## Ocorrência

```
aberta ──► em_analise ──┬──► aprovada ──► resolvida
                        ├──► rejeitada
                        └──► aguardando_informacao ──► em_analise
                                     │
    (a qualquer momento, com motivo) └──► cancelada
```

`aberta` nasce automaticamente de resultado crítico de visita, ou manualmente.
`aprovada` significa que a decisão foi tomada, não que a ação foi executada — quem fecha o
ciclo é `resolvida`. `cancelada` exige motivo registrado.

## Precedência do marcador

Quando as dimensões se sobrepõem, a cor principal segue esta ordem:

| # | Condição | Cor |
|---|---|---|
| 1 | cadastral `bloqueado`/`cancelado`, operacional `suspenso`/`encerrado` | `--color-status-bloqueado` |
| 2 | visita ativa | `--color-status-reservado` |
| 3 | pendência operacional ou ocorrência `aberta`/`em_analise` | `--color-status-pendencia` |
| 4 | transacional | verde / âmbar / laranja / vermelho / cinza |

O popup e o painel lateral mostram as cinco dimensões separadamente, sempre. A precedência
resolve a cor do pino, não substitui a informação.
