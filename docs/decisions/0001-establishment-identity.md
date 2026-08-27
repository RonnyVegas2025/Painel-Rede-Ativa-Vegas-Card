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

- **A normalização virou dependência de coluna gerada (Sprint 1).**
  `establishment_addresses.normalized_address` e `.address_hash` são
  `generated always as (public.normalize_address(street, cep)) stored`. A aplicação
  não grava: um defeito no importador escreveria hash divergente, e hash divergente
  não se corrige sem migração de dados. Como coluna gerada, quem calcula é a mesma
  função que o arnês do ADR 0010 compara com a gêmea TypeScript a cada CI. A gêmea
  continua servindo ao importador para casar linha **antes** de gravar; o valor
  gravado não depende dela.

  **Alterar `public.normalize_address` exige `update` de recálculo na mesma
  migration.** `create or replace function` **não** recalcula colunas geradas já
  materializadas — verificado com o banco no ar: o valor armazenado permanece na
  regra antiga enquanto a função já devolve a nova. A tabela passaria a conter as
  duas regras, indistinguíveis, sem erro nem aviso.

  Três coisas que **não** cobrem isso, e é por isso que a advertência está aqui:

  - O arnês de paridade compara as duas implementações **atuais** entre si, nunca o
    que está gravado contra a função corrente. São verificações de coisas diferentes.
  - "Função congelada" é política escrita, e política escrita não impede
    `create or replace`.
  - O Postgres permite a substituição sem reclamar — não há proteção do banco.

  Quem cobre é `supabase/tests/06_establishments.sql`, que compara valor gravado com
  recálculo e falha no CI. O próprio teste prova que tem dentes: adultera a função,
  confirma que a verificação acusa, e restaura.
- Buscar "todas as lojas deste CNPJ" é uma consulta legítima e frequente — o índice em
  `cnpj` não é opcional.


---

## Correção após a medição da base real (26/08/2026)

O texto acima diz que "o mesmo CNPJ tem vários endereços e contratos". A medição
das 1.804 linhas mostra que **quem repete é a RAIZ** — os oito primeiros dígitos —
e não o CNPJ completo:

| Medida | Valor |
|---|---|
| linhas | 1.804 |
| CNPJs completos distintos | 1.803 (o restante é o CPF do ADR 0014) |
| **raízes distintas** | **294** |
| endereços repetidos | 67 (shoppings) |
| pares CNPJ + endereço repetidos | **0** |

O raciocínio não muda: CNPJ continua não sendo chave, porque a mesma empresa tem
muitos pontos e é a raiz que se repete entre eles. Mas a precisão sim — e a
diferença importa para quem for desenhar agrupamento por empresa na Sprint 2, que é
justamente o caso em que "CNPJ" e "raiz do CNPJ" dão respostas diferentes.
