# ADR 0006 — Worker de geocodificação

- **Status:** aceito
- **Data:** 2026-07-31

## Contexto
Boa parte dos 1.804 registros chega sem coordenada. Geocodificar no navegador é inviável:
milhares de chamadas, chave exposta, aba fechada no meio do processo.

O cron da Vercel no plano Hobby roda uma vez ao dia. Amarrar a fila a isso significa amarrar
a operação ao plano de hospedagem.

## Decisão
Fila em tabela, processada por **Edge Function do Supabase**, acionada por `pg_cron`.

`geocoding_queue`: `address_hash` (unique), `raw_address`, `normalized_address`, `status`,
`attempts`, `last_error`, `provider`, `result_quality`, `latitude`, `longitude`,
`geocoded_at`, `reviewed_by`.

- Deduplicação por `address_hash` — mesma função de normalização do ADR 0001. Endereço já
  resolvido não gasta chamada.
- Backoff exponencial, `attempts` máximo configurável, depois vai para revisão manual.
- Resultado de baixa qualidade (nível cidade, sem número) **não** é aceito em silêncio:
  entra na fila de revisão. Coordenada de centro de cidade quebraria o check-in por raio,
  que é a razão de existir da coordenada.
- Endereço original importado é preservado sempre, intocado.
- Provedor e qualidade gravados por linha, para auditar a base depois.

## Alternativas consideradas
- **Geocodificar durante a importação.** Descartada: transformaria uma importação de 1.804
  linhas numa transação de dezenas de minutos, sujeita a timeout.
- **Cron da Vercel.** Descartada pela dependência de plano.
- **Fila externa.** Descartada: infraestrutura a mais para um volume que cabe folgado no
  Postgres.

## Provedor — direção definida, escolha final pendente

**Google está descartado** por decisão de 02/08. O motivo é contratual, não técnico: os
termos proíbem armazenar coordenadas geocodificadas para exibir em mapa de outro fornecedor,
o que amarraria as duas pontas ao mesmo vendedor e tornaria a base de coordenadas
dependente de uma licença.

Candidatos em avaliação, ambos permitindo armazenar o resultado:

| | Mapbox | MapLibre + Nominatim/Photon |
|---|---|---|
| Geocodificação | Mapbox Geocoding | Nominatim ou Photon |
| Mapa | Mapbox GL JS | MapLibre GL JS (fork livre) |
| Qualidade no Brasil | boa, número e complemento | variável fora de capitais |
| Limite | por contrato | Nominatim público: 1 req/s, uso pesado exige instância própria |
| Custo | por requisição | infraestrutura própria |
| Trava de fornecedor | média | baixa |

Observação que pesa na escolha: Nominatim público tem política de uso estrita e não suporta
carga de importação em massa. Usá-lo para 1.804 endereços de uma vez viola a política —
exigiria instância própria ou Photon com limite negociado.

Decisão final antes da Sprint 2. Até lá, a interface `GeocodingProvider` em
`lib/maps/geocoding-provider.ts` mantém tudo desacoplado: trocar o provedor troca uma
implementação e nada mais. O campo `provider` na fila registra a origem de cada coordenada,
para que uma troca futura permita reprocessar seletivamente.
