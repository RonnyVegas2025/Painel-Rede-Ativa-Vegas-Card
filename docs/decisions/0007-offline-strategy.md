# ADR 0007 — Estratégia offline

- **Status:** aceito
- **Data:** 2026-08-02

## Contexto
O consultor trabalha em pé, dentro da loja, com uma mão no celular. Zona comercial densa,
galeria, subsolo de shopping e posto na rodovia têm sinal ruim ou nenhum. A visita produz
fotos de 3 a 5 MB cada, e o momento em que o consultor precisa registrar é exatamente o
momento em que ele não pode pedir ao lojista para esperar o upload.

Perder uma visita registrada é pior que não registrar: o consultor sai achando que gravou.

## Decisão
Offline **parcial e assimétrico**. Nem tudo precisa funcionar sem rede, e tentar isso
multiplicaria a complexidade sem ganho proporcional.

### O que funciona offline
| Recurso | Como |
|---|---|
| Ver a lista da rota do dia | cache do IndexedDB, carregado ao abrir a ação |
| Ver ficha do estabelecimento reservado | mesmo cache |
| Check-in | GPS é local; grava na fila |
| Checklist, teste, observação | grava na fila |
| Fotos | grava o blob comprimido na fila |
| Concluir visita | grava na fila |

### O que exige rede, sempre
**Reservar.** A exclusividade global do ADR 0002 só existe no banco. Reserva otimista
offline permitiria dois consultores "reservando" o mesmo ponto e descobrindo o conflito
horas depois, na frente do lojista. Sem rede, o botão de reservar fica desabilitado com
mensagem explícita: "Reservar precisa de conexão".

Também exigem rede: aprovar bloqueio, transferir reserva, alterar parâmetro, importar.

### Fila de sincronização
IndexedDB via `idb`, store `sync_queue`:

`id` (uuid gerado no cliente) · `type` · `payload` · `blobs` · `created_at_client` ·
`attempts` · `last_error` · `status` (`pendente` `enviando` `erro` `conflito` `enviado`)

Regras:
- **Idempotência por `client_operation_id`.** Toda mutação carrega um uuid gerado no
  dispositivo. O servidor guarda os já processados e devolve o resultado anterior em vez de
  reprocessar. Sem isso, retry de rede duplica visita.
- **Ordem por visita.** Operações da mesma visita sobem em sequência; visitas diferentes
  sobem em paralelo. Concluir antes do check-in chegar quebraria a máquina de estados.
- **Backoff exponencial** com teto, e retomada automática no evento `online`.
- **Foto comprimida antes de entrar na fila**, não na hora do envio. Guardar 5 MB por foto
  no IndexedDB estoura a cota do dispositivo em poucas visitas.
- **`created_at_client` é registrado e preservado**, mas o `created_at` oficial é o do
  servidor. Relógio de celular está errado com frequência, às vezes em horas.

### Conflitos
Quando a operação sobe e o servidor recusa — reserva expirou e outro consultor pegou o ponto,
visita já concluída, supervisor cancelou — a operação vai para `conflito` e **não é
descartada**. A tela mostra o que foi coletado e oferece: reenviar como nova visita, anexar
à visita existente, ou descartar com confirmação. Trabalho de campo nunca some em silêncio.

### Indicador de estado
A interface mostra permanentemente: online sincronizado · online sincronizando (N) ·
offline com N pendentes · N em conflito. O consultor precisa saber se pode fechar o app.

## Alternativas consideradas
- **Offline completo, incluindo reserva.** Descartada: incompatível com a exclusividade
  global. É a decisão de negócio que define esse limite, não uma limitação técnica.
- **Service Worker com Background Sync.** Complementar, não substituto: o suporte no iOS é
  irregular. A fila funciona com o app aberto; Background Sync entra como melhoria onde
  existir.
- **localStorage.** Descartada: síncrono, limite pequeno, não guarda blob.
- **Sem offline, só retry.** Descartada: perde a visita quando o app é fechado.

## Consequências
- Toda RPC de mutação de visita recebe `client_operation_id` e uma tabela
  `processed_operations` com expurgo periódico. Isso entra no desenho da Sprint 3, não pode
  ser retrofit.
- Existe estado no dispositivo. Logout precisa avisar se há fila pendente e bloquear a
  limpeza até o envio, senão o consultor perde o dia de trabalho ao trocar de conta.
- Testar offline exige simulação real de rede no CI, não apenas mock de fetch.
- A implementação é da Sprint 4. A **decisão** é agora porque `client_operation_id` atravessa
  o desenho das RPCs da Sprint 3.
