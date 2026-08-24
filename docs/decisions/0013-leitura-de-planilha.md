# ADR 0013 — Leitura de `.xlsx` com `exceljs`, atrás de um adaptador

- **Status:** aceito
- **Data:** 2026-08-24

## Contexto

A Sprint 1 precisa ler o arquivo de origem — 1.804 linhas, 20 colunas. O
`CLAUDE.md` exige decisão registrada antes de instalar pacote novo, e ler arquivo
de origem externa é a superfície de ataque mais larga que este sistema tem: o
conteúdo não é escolhido por nós e o parser roda no servidor.

Duas opções reais no ecossistema Node: `xlsx` (SheetJS) e `exceljs`.

## Decisão

**`exceljs`, versão fixada em `4.4.0`, atrás do adaptador
`src/features/importacao/services/ler-planilha.ts`.**

### Por que não `xlsx`

O SheetJS deixou de publicar no registro público do npm e passou a distribuir
pelo próprio CDN. O que está em `npm install xlsx` é versão antiga, com
vulnerabilidade de *prototype pollution* conhecida e **sem correção naquele
canal**. O pacote mais popular para a tarefa é, hoje, software abandonado no
lugar onde as pessoas o procuram.

### Por que `exceljs`

Consistência de plataforma: já é o padrão do CRM Comercial de Credenciamento.
`PLATFORM-STANDARDS.md` existe para que a mesma tarefa não seja resolvida com
biblioteca diferente em cada sistema Vegas.

## Três condições, e o que cada uma protege

### 1. Versão fixada, sem `^`

`"exceljs": "4.4.0"` — instalado com `--save-exact`.

Atualização de parser de arquivo externo entra por decisão, não por resolução de
intervalo de versão. Um `^` faz o parser mudar sozinho entre um `npm ci` e outro.

### 2. Fórmula nunca é avaliada

O adaptador lê o **resultado em cache** da célula (`.result`) e nunca a fórmula.

Fórmula em planilha de origem desconhecida é execução de código de terceiro. O
valor em cache é dado; a fórmula é instrução. O importador lê dado.

### 3. O teto de 20 MB existe no código, não só no Storage

O bucket `import-files` limita a 20 MiB desde a migration 0010. O adaptador
repete o limite em `TAMANHO_MAXIMO_BYTES` e recusa **antes de abrir o parser**.

Limite que só existe no Storage deixa de existir no dia em que o arquivo chegar
por outra porta — e essa porta sempre aparece. A ordem também importa: passar
20 MB de origem desconhecida por um parser para depois recusar é a ordem errada.

## O que o adaptador garante

`lerPlanilha(Buffer)` devolve `LinhaCrua[]` — as 20 colunas na grafia da origem.
Nada abaixo dele conhece o `exceljs`: a regra de negócio recebe `LinhaCrua` e não
sabe de onde veio.

É isso que torna a escolha **reversível**. Se o `exceljs` for abandonado como o
`xlsx` foi, troca-se um arquivo; nenhuma regra de negócio e nenhum teste de
regra muda.

O contrato do arquivo é o **cabeçalho**, não o nome. A versão 1 do `CLAUDE.md`
grafava `Base de Comericos SP.xlsx` com typo; validar por nome teria quebrado na
primeira correção. Colunas fora de ordem são aceitas — a coluna é lida pelo nome.

## Consequências

- `tests/unit/ler-planilha.test.ts` cobre o teto, a fórmula em cache, o cabeçalho
  incompleto, a ordem trocada e a linha em branco no fim.
- O adaptador importa `server-only`. O vitest resolve isso para
  `tests/stubs/server-only.ts`: a garantia do pacote é de **bundle**, e o teste
  não monta bundle. `next build` continua exigindo o real.
- Se a origem passar a enviar `.csv`, é um segundo adaptador ao lado deste, com o
  mesmo contrato — não uma condicional dentro deste.
