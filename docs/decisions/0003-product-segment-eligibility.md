# ADR 0003 — Elegibilidade produto × segmento

- **Status:** aceito
- **Data:** 2026-07-31

## Contexto
Farmácia não pode exibir posto. Vegas Day e Plus aceitam toda a rede. Amanhã pode surgir
modalidade que aceita quase tudo, com três exceções. Um booleano `aceita_todos_segmentos`
convivendo com uma tabela de vínculos gera a pergunta sem resposta: o que vale quando o
booleano é verdadeiro e existe um vínculo negando?

## Decisão
`card_products.eligibility_mode` com três valores, e o booleano deixa de existir.

| Modo | Avaliação |
|---|---|
| `all` | todo segmento ativo é elegível; `product_segments` é ignorado |
| `allowlist` | elegível apenas com registro `rule_type = 'allow'` |
| `denylist` | elegível salvo registro `rule_type = 'deny'` |

`product_segments` tem **`unique (card_product_id, segment_id)`**, sem `rule_type` na chave.

Isso corrige a especificação recebida, que pedia unicidade em
`(produto, segmento, rule_type)` e ao mesmo tempo proibia regras contraditórias. As duas
coisas se anulam: com `rule_type` na chave, `allow` e `deny` para o mesmo par passam a ser
duas linhas legais, e a contradição vira responsabilidade da aplicação. Tirando `rule_type`
da chave, o banco recusa a contradição.

Segmento sem mapeamento **não é elegível** em `allowlist` — falha fechada. Fica na fila de
`/segmentos`, visível e contável.

A função `is_segment_eligible(mode, rule_type | null)` é pura, vive em
`lib/business-rules/check-product-eligibility.ts` e tem gêmea em SQL para o filtro do mapa.

## Alternativas consideradas
- **Booleano + tabela.** Descartada: ambiguidade sem resposta.
- **Regra em JSON no produto.** Descartada: não há integridade referencial, e a tela de
  administração vira editor de JSON.
- **Falha aberta para segmento não mapeado.** Descartada: exibiria posto em Farmácia, que é
  o critério de aceite número um.

## Consequências
- Trocar `allowlist` por `denylist` num produto inverte o significado das linhas existentes.
  A troca de modo exige confirmação na interface, mostra a contagem afetada e registra
  auditoria.
- A qualidade do mapeamento de `Subgrupo` passa a ser bloqueante para a Sprint 2. A fila de
  normalização é entregável da Sprint 1, não um extra.
