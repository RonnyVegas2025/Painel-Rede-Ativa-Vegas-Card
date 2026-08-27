# ADR 0014 — Pessoa física credenciada: CPF no lugar do CNPJ

- **Status:** **EM ABERTO** — aguardando decisão de quem cuida do credenciamento
- **Levantado em:** 2026-08-24, na medição da base real
- **Estado atual:** tratado como **conflito**, importado e sinalizado

## O caso

Uma linha em 1.804. *Mercearia do Carlito*, contrato `61166914`, documento com **11
dígitos** — CPF, não CNPJ. Contrato válido, transacionando, endereço completo.

Não é erro de digitação: é pessoa física credenciada, o que é normal em adquirência.

## O que o sistema faz hoje

Importa e marca como conflito, com o motivo legível na tela:

> `CNPJ: Documento com 11 dígitos (CPF), não CNPJ. Pessoa física credenciada — decisão administrativa pendente.`

`establishments.cnpj` fica nulo — a constraint `establishments_cnpj_digitos` exige
14 dígitos — e a identidade vem do contrato, que existe.

**Rejeitar a linha não foi considerado**, e não é uma das saídas por acaso: dado
perdido na importação não volta. Quem decide se pessoa física pode ser credenciada é
o negócio, não o importador.

## As três saídas

### 1. Aceitar pessoa física — `documento` + `tipo_documento`

`cnpj` vira `documento text` com `tipo_documento` (`cnpj` | `cpf`), e a constraint
passa a validar 14 ou 11 dígitos conforme o tipo.

| | |
|---|---|
| **Custo** | uma migration com `alter table` e cópia de coluna; um ramo em `normalizeLinhaImportacao` |
| **Não muda** | a identidade de fallback — ela passa a ser `documento + hash`, com a mesma forma |
| **A favor** | o comércio está credenciado e transacionando; recusá-lo tira do painel de campo um estabelecimento que existe. Credenciamento de pessoa física é comum em adquirência, então o caso tende a crescer |
| **Contra** | se a regra da Vegas não permite pessoa física, o sistema passa a acomodar o que o cadastro deveria corrigir |

### 2. Rejeitar pessoa física

A linha vira **erro** em vez de conflito, e não entra na base.

| | |
|---|---|
| **Custo** | uma linha em `normalizeLinhaImportacao` (`gravidade: "erro"`) |
| **A favor** | se pessoa física não deveria estar credenciada, o lugar de resolver é o cadastro de origem, não este sistema |
| **Contra** | o comércio existe e transaciona; ele some do painel de campo até alguém corrigir na origem |

### 3. Manter como conflito, resolvido caso a caso

O estado atual. A linha entra, fica visível com o motivo, e alguém decide por
estabelecimento no E-008.

| | |
|---|---|
| **Custo** | zero — já funciona |
| **A favor** | nada se perde, e a decisão fica com quem tem contexto |
| **Contra** | reaparece como conflito em toda importação, até alguém agir. Uma linha hoje; mais na base completa |

## Por que ficou em aberto

Nenhuma das três é irreversível: aceitar é aditivo, rejeitar é aditivo, e o estado
atual é a terceira funcionando. Travar o fechamento da Sprint 1 numa pergunta que
precisa de alguém do cadastro para responder seria desproporcional.

**Quando a resposta vier, é uma migration e um ramo do parser.**

## Recomendação técnica, para quem for decidir

A saída 1, por motivo operacional e não de modelagem: o comércio está credenciado e
vendendo, e o painel de campo existe para chegar até ele.

Mas quem conhece a regra de credenciamento da Vegas decide. Se pessoa física é
exceção que não deveria estar na base, a saída 2 é defensável — e significa apenas
que aquela linha vira caso para o time de cadastro, não registro neste sistema.
