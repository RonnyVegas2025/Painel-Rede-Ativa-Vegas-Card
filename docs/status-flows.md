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

### O caminho administrativo — ausência na planilha

Existe uma segunda origem para `fechado_temporariamente`, e ela não passa por visita: a
resolução da fila de ausentes.

```
importação não traz o registro (dentro do escopo declarado)
        │
        ▼
  absent_since preenchido — fila em /importacoes/ausentes
        │
        ├─ voltou_a_operar   ──► absent_since limpo, operacional INALTERADO
        ├─ escopo_incorreto  ──► absent_since limpo, operacional INALTERADO
        └─ nao_opera_mais    ──► absent_since limpo, operacional = fechado_temporariamente
                                          │
                                          │  só a partir daqui, e só com visita
                                          ▼
                                     encerrado
```

**Ausência na planilha nunca grava `encerrado`.** Não sair num arquivo é evidência mais fraca
que o consultor na porta: pode ser recorte de exportação, filtro esquecido, mudança de
contrato, erro de sistema de origem. `encerrado` é definitivo, e definitivo exige quem viu.

As três resoluções **não são equivalentes**, e é por isso que são três e não um botão de
"resolver":

| Resolução | O que afirma | Efeito |
|---|---|---|
| `voltou_a_operar` | verificado, opera | nenhum no operacional |
| `escopo_incorreto` | o arquivo era um recorte | nenhum no operacional |
| `nao_opera_mais` | apurado que não opera | `fechado_temporariamente` |

`escopo_incorreto` é o caso **mais provável** quando há centenas de uma vez: ninguém perde
1.412 comércios num mês. Tratar as três como a mesma coisa é o que transformaria um erro de
exportação em baixa de cadastro.

A garantia é estrutural: `resolve_absences` **não tem parâmetro de status**. Não há como
pedir `encerrado` a ela — o argumento não existe. Guarda que depende de a próxima pessoa ler
o comentário não é guarda.

Toda resolução grava linha em `absence_resolutions` com motivo obrigatório, o autor, e uma
**cópia** de `absent_since`. Sem a cópia, resolver a fila apagaria a marca e a decisão sumiria
junto — e em três meses ninguém distinguiria "sumiu ontem" de "sumiu em março e já foi
verificado", que é exatamente o problema que a fila existe para resolver.

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
