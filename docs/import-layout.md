# Layout da importação

Restaurado em 24/08/2026. Este conteúdo existia na seção 5 do `CLAUDE.md` versão 1
e se perdeu na reescrita para a versão 2 — foi regressão de documentação, não
ausência de definição. O arquivo estava vazio, com zero bytes, quando a Sprint 1
começou.

---

## Arquivo-base

`Base de Comercios SP.xlsx` — 1.804 estabelecimentos.

> A versão 1 do `CLAUDE.md` grafava `Base de Comericos SP.xlsx`, com typo. **O
> importador não deve depender do nome do arquivo**, apenas do cabeçalho. Nome de
> arquivo é convenção de quem exporta e muda sem aviso.

## Colunas — 20, na ordem original

| # | Coluna | Destino |
|---|---|---|
| 1 | `Empresa` | nome fantasia |
| 2 | `Data de Cadastro` | `relationship_start_date` (DD/MM/AAAA) |
| 3 | `Contrato` | **identidade prioritária** (`external_contract`) |
| 4 | `CNPJ` | atributo indexado, 14 dígitos — **nunca chave única** (ADR 0001) |
| 5 | `Razão Social` | razão social |
| 6 | `Status` | status cadastral |
| 7 | `Descrição` | descrição |
| 8 | `Endereço` | endereço bruto, preservado intocado; alimenta `normalize_address` |
| 9 | `CEP` | 8 dígitos; entra no hash de identidade |
| 10 | `Cidade` | cidade |
| 11 | `UF` | unidade federativa |
| 12 | `Telefone` | telefone normalizado |
| 13 | `CNAE` | `segments.cnae_hint` |
| 14 | `Subgrupo` | **valor cru** de `segments.source_name` — não normalizar |
| 15 | `Consultores` | vínculo com carteira |
| 16 | `Origem` | origem do credenciamento |
| 17 | `E-mail` | e-mail |
| 18 | `Captação` | `capture_methods.source_name` — valor cru |
| 19 | `Terminal` | `establishment_capture_points` — deixou de ser coluna e virou tabela filha |
| 20 | `Última Transação` | `last_transaction_at` (DD/MM/AAAA) |

## Regras definidas

- **CNPJ** com 14 dígitos; **CEP** com 8. Fora disso, o valor não normaliza e a
  linha vai para erro ou conflito, conforme o campo.
- **Datas de entrada em DD/MM/AAAA.**
- `Última Transação` com o valor `Nunca Transacionou` ⇒ `last_transaction_at = null`
  e `never_transacted = true`. São coisas diferentes: nulo por ausência de dado não
  é o mesmo que nulo por nunca ter transacionado, e a flag é explícita justamente
  para a classificação não inferir por nulo.
- `Subgrupo` é a origem de `segments.source_name`, **cru, sem normalizar** — é a
  chave de reconciliação na próxima importação. O rótulo humano é
  `normalized_name`. Mesma disciplina para `Captação` em `capture_methods`.
- **Identidade:** `Contrato` quando presente e único no arquivo. Fallback
  controlado: CNPJ + endereço normalizado (ADR 0001). Colisão de contrato dentro
  do mesmo arquivo não decide sozinha — vai para `import_rows` com status de
  conflito, para resolução administrativa.
- **Importação idempotente**, com prévia, validação e relatório. Rodar o mesmo
  arquivo duas vezes não pode duplicar nada.
- **Geocodificação após a importação, nunca durante** (ADR 0006). A importação
  apenas popula `geocoding_queue`.

## Escopo e ausentes

Registro presente na base e ausente do arquivo **nunca é excluído**: vai para
análise administrativa. Mas também não pode ficar invisível — a decisão depende de
alguém ver a lista, então a prévia lista os ausentes, não só os conta.

`import_jobs` carrega escopo explícito — `scope_city`, `scope_card_product_id`,
nulos significando "toda a base". O estado `ausente` só é calculado **dentro do
escopo declarado**.

**Trava de segurança:** se uma importação marcaria mais de um limiar da base como
ausente — sugestão de 20%, parametrizável em `system_settings` — o job para e
exige confirmação explícita, com o número na tela. O desastre clássico é alguém
exportar a planilha com um filtro aplicado e a base inteira aparecer como sumida.
Nada seria excluído, mas uma fila administrativa com 1.400 itens é indistinguível
de ruído, e o efeito prático é o mesmo.

**A primeira importação nunca calcula ausentes** — não há contra o que comparar.

## O que o arquivo real respondeu

O `.xlsx` chegou e foi medido: **1.804 linhas, 20 colunas**, recorte de São Paulo.
As perguntas que estavam em aberto aqui deixaram de ser expectativa.

| Medida | Valor | O que decidiu |
|---|---|---|
| linhas | 1.804 | — |
| `Terminal` distintos | 13 | dimensão de `capture_methods` |
| `Terminal` com dígito | **0** | `Terminal` não é número de terminal: é nome de adquirente e gateway, separados por ` / `. A chave `(capture_method_id, terminal_number)` não existe |
| estabelecimentos com mais de um meio | maioria | `is_primary` é regra, não exceção |
| `Subgrupo` distintos | 15 | tamanho inicial da fila de normalização |
| linhas sem `Contrato` | **0** | o fallback do ADR 0001 não é exercitado por esta base — e continua necessário, porque a próxima pode exercitá-lo |
| raízes de CNPJ distintas | 294 | o mesmo CNPJ tem vários endereços e contratos: CNPJ não é chave |
| endereços com `N.º: 0` | 61 | sinalizados na prévia, não rejeitados |
| `E-mail` com `-` | 1.255 | `-` é placeholder de vazio, normalizado para nulo |
| documentos com 11 dígitos (CPF) | 1 | pessoa física credenciada — **conflito, não erro** |
| `Nunca Transacionou` | 319 | `last_transaction_at = null` + `never_transacted = true` |

### 3.586 partes brutas, 3.577 vínculos

A distinção importa e alguém vai refazê-la errado se ela não estiver escrita.

Somando as partes de `Terminal` de todas as linhas, dão **3.586**. Mas **9 linhas
repetem o mesmo meio dentro da própria célula** — `CIELO / CIELO`,
`Software Express Sitef / CIELO / Rede / Rede`. Como a identidade de um ponto de
captura é `(establishment_id, capture_method_id)`, inserir as duas ocorrências
violaria o índice único e a primeira importação inteira falharia.

Deduplicadas, restam **3.577 vínculos** — e é esse o número esperado em
`establishment_capture_points` depois da primeira importação.

**3.586 conta partes brutas; 3.577 conta linhas gravadas.**

A repetição é defeito da **origem**, não conflito: não bloqueia nada e não exige
decisão. Mas a prévia **conta e reporta** as 9 em
`import_jobs.duplicated_capture_methods`. Deduplicar em silêncio faria o dado
errado voltar em toda importação sem ninguém notar, e quem mantém a base é quem
pode corrigi-lo na fonte.

### Distribuição de recência

`293 recente · 285 atenção · 132 ação necessária · 775 crítico · 319 nunca transacionou`

### O que o arquivo não respondeu

Ele é um **recorte**: uma cidade, um momento. Nada aqui autoriza concluir que a
base inteira tem as mesmas proporções — em particular, "zero linhas sem contrato"
é uma propriedade deste arquivo, não da fonte. O fallback de identidade continua
implementado e testado.
