# ADR 0001 — Identidade do estabelecimento

- **Status:** aceito
- **Data:** 2026-07-31

## Contexto
A planilha traz 1.804 registros com `CNPJ`, `Contrato`, `Endereço` e `Terminal`. O mesmo CNPJ
aparece com mais de um endereço, mais de um contrato e mais de um ponto de captura — rede de
farmácias com várias lojas, posto com duas bandeiras, comércio que trocou de maquininha.

A importação é recorrente e precisa ser idempotente: rodar o mesmo arquivo duas vezes não
pode duplicar nada.

## Decisão
A unidade do sistema é o **ponto credenciado**, não a empresa.

Chave de identidade, em ordem:
1. `external_contract` quando presente e único no arquivo.
2. Fallback controlado: `cnpj + hash(endereço normalizado)`.

`cnpj` é atributo indexado, **nunca** chave única.

Normalização do endereço para o hash: minúsculas, sem acento, abreviações expandidas
(`av.` → `avenida`), espaços colapsados, CEP anexado.

Colisão de contrato dentro do mesmo arquivo não decide sozinha: a linha vai para
`import_rows` com status de conflito, para resolução administrativa.

## Alternativas consideradas
- **CNPJ como chave.** Descartada: colapsaria lojas distintas da mesma rede num registro só,
  e o consultor não conseguiria visitar a segunda loja.
- **Só o contrato, sem fallback.** Descartada: a planilha tem contrato ausente em parte das
  linhas, e essas linhas duplicariam a cada importação.
- **Chave sintética por linha.** Descartada: quebra a idempotência inteira.

## Consequências
- A tabela de endereços é histórica, com `is_current`, para `mudanca_endereco` preservar o
  anterior.
- O hash do endereço precisa ser estável: mudar a função de normalização depois exige
  migração de dados. A função fica em `lib/business-rules` com teste de regressão.
- Buscar "todas as lojas deste CNPJ" é uma consulta legítima e frequente — o índice em
  `cnpj` não é opcional.
