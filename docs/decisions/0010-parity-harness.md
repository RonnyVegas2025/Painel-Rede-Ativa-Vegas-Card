# ADR 0010 — Arnês de paridade entre SQL e TypeScript

- **Status:** aceito
- **Data:** 2026-08-24

## Contexto

Regras que existem nas duas linguagens são o risco estrutural deste sistema. A
classificação transacional é o primeiro caso: o filtro do mapa roda em SQL, o
rótulo da tela roda em TypeScript. Divergir significa a lista dizer "crítico" e o
mapa não trazer o ponto no filtro de críticos — sem erro, sem log, sem sintoma.

O `PLATFORM-STANDARDS.md` §8 já previa "paridade entre implementação SQL e
TypeScript · Vitest contra banco local". O que existia não era isso.

Havia duas listas de casos — `tests/parity/transaction-status-parity.test.ts` e
`supabase/tests/04_transaction_status_parity.sql` — cada uma comparando sua
implementação com **expectativas escritas à mão**, mais uma asserção de "mesma
quantidade de casos" para amarrá-las.

As duas metades nunca se encontravam. Consequências, ambas observadas na
validação da Sprint 0:

- O teste pgTAP das bordas reprovava `calculate_transaction_status` por um erro
  que estava na construção da entrada do próprio teste. A função estava certa; a
  suíte acusava a função.
- Se a expectativa estivesse errada nos dois arquivos, ambos ficariam verdes e o
  sistema classificaria tudo errado em silêncio. Contar casos não compara
  resultado: é proxy fraco com aparência de garantia.

## Decisão

Paridade é: **mesma entrada nas duas implementações, saídas comparadas entre si,
sem expectativa no meio.**

- `tests/fixtures/` guarda as entradas, **sem valores esperados**.
- `tests/parity-db/harness.ts` conecta ao Postgres local, executa a função SQL e
  a função TypeScript com a mesma entrada e afirma que as saídas são iguais.
- O arnês é **genérico**: recebe o nome da função SQL, os argumentos, a função
  TypeScript e a lista de entradas. Não conhece recência.
- pgTAP fica com o que só se verifica dentro do banco — policy, constraint,
  trigger, e os invariantes de grant e RLS de `05_grants_and_rls.sql`. O
  `04_transaction_status_parity.sql` foi removido: duplicava sem cruzar.
- Os testes de valor esperado sobre a função TypeScript continuam, em
  `tests/unit/transaction-status.test.ts`. **Paridade prova que as duas
  implementações concordam, não que estão certas.** As duas verificações são
  necessárias e nenhuma cobre a outra.

### Instante de referência

As duas implementações recebem o mesmo `now()`, lido do banco. A função SQL usa o
relógio do servidor; a TypeScript recebe o instante por argumento. Ler o relógio
local em vez do relógio do banco introduziria uma divergência do próprio arnês.

### Dependência nova

`pg` e `@types/pg`, em `devDependencies`. É o cliente que o "Vitest contra banco
local" exige. Não entra no bundle: nada em `src/` importa.

Descartado usar `supabase-js` por RPC: passaria pelo PostgREST, o que acrescenta
exposição de schema e privilégio de execução como variáveis do teste. O arnês
deve falhar por divergência de regra, não por configuração de API.

### Onde roda

Em `npm run test:parity`, com configuração própria (`vitest.parity.config.ts`), e
no job `banco` do CI, que já sobe o stack. Fora do `npm run test`, que roda sem
infraestrutura no job `aplicacao`.

**O arnês falha quando o banco não responde; não pula.** Um teste de paridade que
se ignora em silêncio daria verde exatamente na situação em que não verificou
nada — a forma de falha que ele existe para eliminar.

## Alternativas consideradas

- **Manter as duas listas e reforçar a contagem.** Descartada: nenhuma contagem
  compara resultado, e o erro comum aos dois lados continua invisível.
- **Gerar o SQL a partir do TypeScript, ou o contrário.** Elimina a divergência
  na origem, mas troca uma regra legível em cada linguagem por um gerador que
  ninguém revisa. Descartada por ora.
- **Arnês específico de recência.** Mais simples hoje e reescrito na Sprint 1.
  Descartada pelo motivo abaixo.

## Por que genérico, e por que antes da Sprint 1

O ADR 0001 define que o hash do endereço normalizado é **persistido**, como parte
da chave de identidade do ponto credenciado. A Sprint 1 vai criar uma gêmea SQL
de `normalizeAddress`.

Se as duas divergirem em um hífen, a importação duplica pontos credenciados e
ninguém descobre até a base estar suja. É o mesmo padrão de falha da
classificação transacional, com consequência pior: **hash persistido não se
corrige sem migração de dados.**

Com o arnês genérico, `normalize_address` entra na Sprint 1 com um arquivo de
entradas e uma definição. Nada em `harness.ts` muda.

## Cobertura atual

| Função SQL | Gêmea TypeScript | Entradas |
|---|---|---|
| `calculate_transaction_status` | `calculateTransactionStatus` | `tests/fixtures/transaction-status.ts` |
| `is_segment_eligible` | `isSegmentEligible` | `tests/fixtures/segment-eligibility.ts` |

`is_segment_eligible` é o caso que justifica o arnês retroativamente: a gêmea
TypeScript sempre devolveu booleano, a SQL devolvia **NULL** para segmento sem
regra em modo `allowlist` (B-7). Verificado restaurando a função defeituosa — o
arnês acusa `{ sql: null, ts: 'false' }` na primeira entrada da lista. O defeito
tinha atravessado a revisão e só aparecera no pgTAP.

`normalize_address` entra no **primeiro commit da Sprint 1**, antes de qualquer
importação gravar hash. Ver a seção seguinte.

## Consequências

- Entrada nova se acrescenta em um lugar só, e passa a valer para as duas
  implementações.
- Divergência aponta os dois valores lado a lado — `{ sql: 'atencao', ts:
  'recente' }` — em vez de acusar uma das implementações.
- O job `banco` do CI passou a precisar de Node e `npm ci`, que antes não usava.
- Toda regra nova que existir nas duas linguagens deve entrar no arnês na mesma
  sprint em que for escrita. Fora dele, a divergência só aparece em produção.
