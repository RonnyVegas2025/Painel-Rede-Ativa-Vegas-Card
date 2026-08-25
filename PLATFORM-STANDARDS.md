# Plataforma Vegas — padrões globais

> Regras que valem para **todos** os sistemas internos da Vegas. O que é específico de
> um projeto vive no `CLAUDE.md` daquele projeto.
>
> Todo projeto novo começa lendo dois documentos: este e o `CLAUDE.md` local.

| | |
|---|---|
| Versão deste documento | 1.0 |
| UI Standard consumido | **1.0** (`docs/VEGAS-PLATFORM-UI-STANDARD.md`) |
| Primeiro projeto | Painel Rede Vegas Ativa |

---

## 1. Divisão de responsabilidade

| Onde | O que |
|---|---|
| `PLATFORM-STANDARDS.md` | visual, código, pastas, acessibilidade, testes, nomenclatura, versionamento |
| `docs/VEGAS-PLATFORM-UI-STANDARD.md` | norma visual completa, com as tabelas de token |
| `CLAUDE.md` do projeto | domínio, regras de negócio, decisões locais |
| `docs/decisions/` do projeto | ADRs locais |

Conflito entre este documento e o `CLAUDE.md` de um projeto: **vale este**, salvo
exceção registrada em ADR do projeto, com justificativa. Exceção silenciosa é erro.

---

## 2. Identidade visual

A norma completa está em `docs/VEGAS-PLATFORM-UI-STANDARD.md`. O que não pode ser
esquecido:

**A marca pinta a interface; o dado tem escala própria.** Violeta e índigo identificam
navegação e autoria. Status operacional usa escala semântica. Um marcador de mapa na cor
da marca não comunica nada.

**Cor nunca é o único canal.** Ícone, forma, contorno e texto acompanham. Vale para
badge, marcador, KPI e alerta.

**Hexadecimal só no arquivo canônico de tokens.** Componente usa `var(--vg-*)`. Um `#`
dentro de componente é bug de revisão.

**O gradiente é assinatura, não fundo.** Faixa de 2 a 3 px no topo do login, no item
ativo da sidebar, em progresso. Nunca atrás de conteúdo.

---

## 3. Estrutura de pastas

```
src/
├── app/                  rotas. Orquestram; não decidem regra de negócio.
├── features/<modulo>/    domínio
│   ├── components/ services/ hooks/ validations/ types/ utils/
├── components/           ui/, layout/, brand/ — não conhecem domínio
├── lib/
│   ├── business-rules/   funções puras. Não leem banco.
│   ├── permissions/      espelho da matriz; não é controle de acesso
│   ├── settings/         único lugar que lê parâmetros
│   └── supabase/         client, server, middleware, admin
├── constants/            valores e enums. Nunca importa business-rules.
├── types/                tipos compartilhados
└── styles/tokens.css     fonte canônica de tokens
```

**Regra de dependência:** sempre para baixo. `constants` não importa nada do projeto.

---

## 4. Convenções de código

- **TypeScript estrito. `any` é erro de lint**, não aviso.
- **Regra de negócio não lê banco.** Recebe parâmetros por argumento — é o que a torna
  testável sem infraestrutura.
- **Nenhum parâmetro operacional fixo em componente.** Prazo, raio, limite e faixa vêm de
  tabela de configuração.
- **Estado derivado nunca é gravado.** Se depende de parâmetro configurável, calcule.
  Gravado, vira mentira silenciosa quando o parâmetro muda.
- **Permissão vive no banco.** Esconder botão é conveniência de interface.
- **Toda transição de estado é registrada com o momento em que ocorreu.** Analítica não
  se retroage.

---

## 5. Nomenclatura

| Item | Convenção | Exemplo |
|---|---|---|
| Arquivo TS/TSX | kebab-case | `calculate-transaction-status.ts` |
| Componente React | PascalCase | `StatusBadge` |
| Função e variável | camelCase | `calculateReservationExpiry` |
| Constante exportada | SCREAMING_SNAKE | `VISIT_ACTIVE_STATUSES` |
| Tabela e coluna | snake_case, tabela no plural | `establishment_capture_points` |
| Enum do banco | snake_case singular | `visit_status` |
| Valor de enum | snake_case | `checkin_realizado` |
| Função SQL | `fn_` para trigger, verbo para o resto | `fn_audit`, `calculate_transaction_status` |
| Token CSS | `--vg-<grupo>-<nome>` | `--vg-border-field` |
| Rota | português, kebab-case | `/minhas-visitas` |

**Idioma:** interface, rota, tabela e coluna em **português**. Nome de arquivo, função e
variável em **inglês**. Comentário e documentação em português. É a convenção em vigor;
o que importa é não misturar dentro de uma mesma camada.

**Constantes e regras não compartilham nome de arquivo.** `constants/transaction-status.ts`
guarda os valores; `business-rules/calculate-transaction-status.ts` guarda a função.

---

## 6. Componentes compartilhados

Catálogo conceitual na seção 23 do UI Standard. Enquanto não houver biblioteca:

**Um componente só é candidato a compartilhado depois de existir, igual, em dois
projetos.** Componente promovido cedo demais vira dependência de um consumidor só, com
custo de manutenção de biblioteca e benefício de nenhum.

Critérios para promover:
1. Existe em dois ou mais projetos
2. A API é a mesma, sem parâmetro que exista para atender um caso específico
3. Não conhece domínio nenhum
4. Tem estados default, hover, focus, active, disabled, loading e erro

---

## 7. Acessibilidade — mínimo não negociável

- Contraste **AA** para texto; **3:1** para borda de componente interativo
- Foco visível em todo controle
- Navegação por teclado completa no desktop
- Alvo de toque **44 px** no mobile
- Status nunca comunicado só por cor
- `prefers-reduced-motion` respeitado
- Ícone e botão de ícone com nome acessível
- Tabela com cabeçalho semântico

Estes itens entram na revisão como qualquer outro requisito. Contraste abaixo do mínimo
é bug, não preferência estética.

---

## 8. Testes

| Alvo | Ferramenta |
|---|---|
| Regra pura, utilitário, matriz de permissão | Vitest |
| Paridade entre implementação SQL e TypeScript | Vitest contra banco local |
| Policy, constraint, função e trigger | pgTAP |
| Sincronização de token entre CSS e TS/JSON | Vitest |

**Policy não se testa fora do banco.** A verificação precisa acontecer com o papel
assumido, ou não está verificando nada.

Toda linha de matriz de permissão tem teste correspondente que assume o papel e verifica
que a operação proibida falha.

### Verificação que depende de outra etapa ter feito a coisa certa não é verificação

A Sprint 1 do Painel Rede Ativa produziu quatro ocorrências da mesma forma, e as quatro
passaram despercebidas por um teste verde:

| Ocorrência | O que a verificação realmente respondia |
|---|---|
| Policy de RLS sem `GRANT` de tabela | "ninguém consegue escrever" — não "a política recusa" |
| View sem `security_invoker` | "o dono pode ler" — não "o papel pode ler" |
| Trava de ausentes lendo `requires_confirmation` | "a prévia calculou o campo" — não "o volume é aceitável" |
| Limpeza de ausência dentro do ramo `atualizado` | "o dado mudou" — não "o registro reapareceu" |

O padrão é sempre o mesmo: uma pergunta é usada no lugar de outra, e o teste passa por
**ausência** — de privilégio, de dado, de caminho percorrido. Recusa por indisponibilidade
se parece com recusa por política; contagem que não aconteceu se parece com contagem zero.

Três consequências práticas:

1. **A trava recalcula.** Verificação não lê um campo que outra etapa gravou. Se o commit
   precisa saber quantos registros somem, ele conta — não pergunta à prévia.
2. **Toda trava nova nasce com a injeção do defeito registrada.** Escrever o teste não
   basta: remove-se a proteção, confirma-se que o teste fica vermelho, e a injeção fica
   descrita no comentário ou na mensagem de commit. Teste que nunca falhou não é evidência
   de nada.
3. **Asserção sobre o que *não* mudou precisa de valor distinto.** Dentro de uma transação,
   `now()` é constante e comparar `now()` com `now()` passa mesmo com o gatilho disparando.
   O mesmo vale para comparar conjuntos que mudaram de tamanho entre as duas medições — a
   diferença vem da população, não da escrita.

### Verificação impossível de falhar também não é verificação

O outro lado da regra acima. Uma verificação pode não depender de etapa nenhuma e ainda
assim não verificar — porque não existe estado do mundo em que ela fique vermelha.

O teste de dentes é o que distingue as duas: **remova a proteção e confirme que o teste
falha.** Se não falhar, ou a asserção é vácua, ou ela verifica outra coisa.

Dois casos reais, os dois descobertos injetando o defeito e nenhum descobrível lendo:

- Uma asserção de que a RPC recusada não deixava o job preso em estado transitório. Não há
  como ela falhar: a exceção reverte a transação que a levantou, então a transição volta
  junto, qualquer que seja a ordem das linhas na função. Foi removida — asserção que não
  pode falhar não cobre nada e ainda cobra o preço de parecer que cobre.
- Uma varredura que procurava a chamada `is_admin` no corpo da função. `pg_get_functiondef`
  devolve o corpo **com os comentários**, e o bloco que explicava por que a checagem estava
  ali bastava para o casamento. A asserção passava com a checagem desativada: respondia
  "alguém escreveu `is_admin` em algum lugar", não "a função chama `is_admin`".

Quando a remoção da proteção não é encenável, a asserção precisa ser reescrita até que
seja. Corolário: **a injeção fica registrada** — no comentário da asserção ou na mensagem
de commit —, senão a próxima pessoa a mexer não sabe o que ela cobre.

### Proibição sem caminho legítimo produz contorno, não obediência

Antes das regras de teste, uma de desenho — porque ela evita o defeito em vez de detectá-lo.

`import_rows` tinha policy de leitura e **nenhuma de escrita**. Parecia a posição mais
segura possível. Era o contrário: a importação precisa gravar aquelas linhas de algum jeito,
e o único jeito que restava era o cliente `service_role`, que ignora a RLS inteira. A
ausência de policy não restringia nada — encaminhava o trabalho para fora da fronteira.

Ao fechar um caminho, verifique se o trabalho que ele servia ainda tem uma porta:

- **Existe caminho legítimo para a tarefa real?** Se a única saída é o mecanismo que
  contorna a segurança, a proibição está produzindo o contorno.
- **A porta legítima é a mais fácil?** Se contornar dá menos trabalho, alguém vai contornar
  — sob prazo, e com boa intenção.
- **A restrição está no lugar certo?** "Evidência é imutável" é sobre `UPDATE` e `DELETE`.
  Aplicada também ao `INSERT`, proíbe o registro de existir.

O mesmo vale fora de RLS: campo somente-leitura sem fluxo de correção vira correção por SQL
direto; ambiente bloqueado sem via de exceção vira credencial compartilhada.

### Varredura vence correção pontual

Quando um defeito é encontrado varrendo o schema em vez de lendo código, **a varredura é o
entregável, não a correção.** A instância corrigida era a única naquele dia; a próxima
nasce igual, e ninguém vai lembrar de varrer de novo.

Toda categoria de superfície privilegiada tem inventário declarado em teste: tabela sem
RLS, `TRUNCATE` concedido, view sem `security_invoker`, função `SECURITY DEFINER`
executável por `authenticated`. Item novo fora da lista quebra a suíte, e quem o adiciona
declara por escrito por que é seguro. Não há terceira opção, e é de propósito.

### Teste vermelho por motivo rotineiro é teste que ninguém lê

Corolário do anterior, e o mais fácil de deixar passar: uma asserção pode estar correta e
ainda assim apodrecer, se fica vermelha em situação legítima e frequente.

O caso concreto: `capture_methods` nasce vazia era verdade sobre o **seed**, não invariante
do schema. Ficava vermelha em todo banco local onde alguém tivesse importado — que é o
trabalho normal de três etapas seguidas. Substituída pelo invariante que sobrevive à base
importada: toda linha tem origem rastreável a uma importação.

Duas regras práticas:

- **Fixture de teste não pode colidir com dado real.** Nomes com prefixo reservado
  (`TESTE `), e-mails no TLD `.invalid`, e escopo próprio — uma cidade de fixture, não a
  cidade que a operação usa. Fixture que colide aborta o arquivo inteiro antes da primeira
  asserção, e o erro que aparece não tem nada a ver com o que se estava testando.
- **Asserção conta as próprias fixtures, não a tabela inteira.** `count(*) from tabela = 1`
  amarra o teste ao estado do banco; `count(*) ... where <marca da fixture> = 1` verifica o
  mesmo fato e sobrevive a qualquer base.

---

## 9. Documentação

Todo projeto mantém:

```
CLAUDE.md                    fonte de verdade do projeto
PLATFORM-STANDARDS.md        este documento
docs/
├── architecture.md          camadas e decisões estruturais
├── data-dictionary.md       esquema comentado
├── permissions.md           matriz completa
├── status-flows.md          máquinas de estado
├── business-rules.md        regras de negócio
├── acceptance-tests.md      critérios de aceite e onde são verificados
├── roadmap.md               sprints e visão de longo prazo
├── setup-validation.md      instalação e verificações
├── VEGAS-PLATFORM-UI-STANDARD.md   cópia da norma, com a versão consumida
└── decisions/               ADRs
```

**Decisão estrutural vira ADR.** Se a escolha determina desenho de tabela ou de módulo, é
ADR — não comentário no código nem detalhe de sprint. O ADR registra o que foi
descartado e por quê; sem isso não serve para nada daqui a um ano.

---

## 10. Versionamento do padrão

Enquanto houver poucos sistemas, o padrão é documento versionado. Cada repositório
registra no `CLAUDE.md` a versão consumida.

Com três ou mais sistemas ativos: extrair `@vegas/tokens`.
Quando os componentes estabilizarem: avaliar `@vegas/ui`.

**Mudança de token ocorre na fonte canônica primeiro**, com registro da decisão.
Consumidor atualiza por versão. Cópia silenciosa entre projetos é o que produz a
divergência que o padrão existe para evitar.

Versionamento semântico quando os pacotes existirem: mudança de valor de token é
`minor`; remoção ou renomeação de token é `major`.

---

## 11. Fluxo de trabalho

Planejar → implementar → testar → **reportar bugs encontrados** → corrigir → atualizar
documentação → concluir.

Nenhuma etapa começa sem a anterior validada em ambiente real. Bug encontrado por teste é
resultado esperado do processo, não falha dele.
