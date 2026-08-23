# ADR 0004 — Precedência de status no marcador

- **Status:** aceito
- **Data:** 2026-07-31

## Contexto
O mesmo ponto pode estar, simultaneamente: cadastral `ativo`, transacional `critico`,
operacional `problema_tecnico`, com visita `reservada` e ocorrência `em_analise`. O marcador
tem uma cor só.

Agrava: a paleta da marca Vegas é índigo, violeta e coral — vizinha do azul de "reservado",
do roxo de "pendência" e do vermelho de "crítico". Sob sol, num celular, a distinção some.

## Decisão
Ordem fixa para a **cor** do marcador:

1. Indisponibilidade — `bloqueado` `cancelado` `suspenso` `encerrado`
2. Visita ativa — `reservada` `em_deslocamento` `checkin_realizado` `em_atendimento`
3. Pendência ou ocorrência — `problema_tecnico` `bloqueio_solicitado`
   `equipamento_indisponivel` `mudanca_proprietario` `mudanca_endereco`, ocorrência
   `aberta` ou `em_analise`
4. Transacional — faixas de recência

A cor resolve o pino. **Não resolve a informação**: popup e painel lateral exibem as cinco
dimensões separadamente, sempre, com rótulo.

Duas regras que vêm junto e não são negociáveis:

- **A marca pinta a interface, nunca o dado.** Índigo, violeta e coral ficam para navegação,
  cabeçalho e ações. Os status usam a rampa própria de `globals.css`.
- **Cor nunca é o único canal.** Verde/laranja/vermelho é a combinação mais difícil para
  daltonismo, que atinge cerca de 8% dos homens. Cada marcador leva ícone, anel e
  `aria-label` com as cinco dimensões em texto.

## Alternativas consideradas
- **Cor composta ou marcador dividido.** Descartada: ilegível em cluster e no tamanho real.
- **Deixar o usuário escolher a dimensão colorida.** Boa ideia para depois; ruim como padrão,
  porque dois consultores veriam mapas diferentes ao combinar rota por telefone.
- **Precedência pelo transacional no topo.** Descartada: esconderia bloqueio, que é a
  informação mais cara de ignorar.

## Consequências
- `resolveMarkerStatus()` é função pura, com teste cobrindo cada prioridade e os empates.
- A legenda do mapa precisa explicar que a cor é a prioridade máxima, não o estado completo.
  Sem isso o usuário conclui que a loja azul está em dia.
- A tela de detalhe fica mais densa. É o preço de não mentir por simplificação.
