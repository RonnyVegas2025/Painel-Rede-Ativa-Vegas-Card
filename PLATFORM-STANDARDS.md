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

Toda linha de matriz de permissão tem teste correspondente que assume o papel e
verifica que a operação proibida falha.

---

### A pergunta que organiza esta seção

Um teste verde afirma alguma coisa. **O quê, exatamente?**

Quase todos os defeitos que atravessaram revisão nos sistemas Vegas passaram por
testes verdes — e em cada caso a resposta a essa pergunta era diferente do que
parecia. As regras abaixo são formas de errar essa resposta, ordenadas da mais
comum para a mais sutil.

---

### 8.1 Verificação que depende de outra etapa não é verificação

Uma pergunta usada no lugar de outra, e o teste passa por **ausência** — de
privilégio, de dado, de caminho percorrido.

| O teste parecia dizer | Dizia de fato |
|---|---|
| "a policy recusa" | "ninguém consegue escrever" — faltava o `GRANT` |
| "o papel pode ler" | "o dono pode ler" — view sem `security_invoker` |
| "o volume é aceitável" | "a prévia calculou o campo" |
| "o registro reapareceu" | "o dado mudou" |
| "está autenticado" | nada sobre papel — RPC `definer` sem checagem |

Recusa por indisponibilidade se parece com recusa por política. Contagem que não
aconteceu se parece com contagem zero.

**A trava recalcula.** Verificação não lê um campo que outra etapa gravou. Se o
commit precisa saber quantos registros somem, ele conta — não pergunta à prévia.

### 8.2 Verificação impossível de falhar também não é verificação

O outro lado. Uma asserção pode não depender de etapa nenhuma e ainda assim não
verificar, porque não existe estado do mundo em que fique vermelha.

**O teste de dentes distingue as duas: remova a proteção e confirme que o teste
falha.** Se não falhar, ou a asserção é vácua, ou verifica outra coisa.

Dois casos reais, os dois descobertos injetando o defeito e nenhum descobrível
lendo:

- Uma asserção de que a RPC recusada não deixava o job preso em estado transitório.
  Não há como falhar: a exceção reverte a transação que a levantou. **Foi removida**
  — asserção que não pode falhar não cobre nada e ainda cobra o preço de parecer que
  cobre.
- Uma varredura que procurava a chamada `is_admin` no corpo da função.
  `pg_get_functiondef` devolve o corpo **com os comentários**, e o bloco que
  explicava a checagem bastava para o casamento. Passava com a checagem desativada.

Quando a remoção da proteção não é encenável, a asserção precisa ser reescrita até
que seja. **A injeção fica registrada** — no comentário ou na mensagem de commit —
senão a próxima pessoa não sabe o que a asserção cobre.

### 8.3 Asserção sobre o que *não* mudou precisa de valor distinto

Dentro de uma transação, `now()` é constante: comparar `now()` com `now()` passa
mesmo com o gatilho disparando. Um gatilho `BEFORE UPDATE` chega a sobrescrever o
próprio valor semeado.

O mesmo vale para conjuntos que mudaram de tamanho entre as duas medições — a
diferença vem da população, não da escrita. **Fixe o conjunto antes.**

### 8.4 O teste roda com o privilégio de quem?

- **Asserção de esquema** — índice existe, constraint declarada, policy presente:
  pode rodar como superusuário. Lê o catálogo, e o catálogo é o mesmo para todos.
- **Asserção de constraint** — também roda como superusuário, e **não por omissão**:
  constraint vale para todo papel, e assumir o papel faria a RLS bloquear o insert
  *antes* de a constraint ser alcançada. O teste falharia pelo motivo errado.
- **Asserção de comportamento com privilégio** — isto pode ser chamado, aquilo é
  recusado: **precisa assumir o papel**, ou está medindo o ambiente.

Um arquivo de teste ficou verde durante uma quebra real porque rodava tudo como
superusuário — uma revogação de `execute` derrubou a tela e o teste não viu.
Superusuário não esbarra em privilégio nenhum.

Semear fixtures como superusuário é correto, e não concessão: semear não é o
comportamento sob teste.

### 8.5 Teste vermelho por motivo rotineiro é teste que ninguém lê

Uma asserção pode estar correta e ainda apodrecer, se fica vermelha em situação
legítima e frequente.

Caso concreto: *"a tabela nasce vazia"* era verdade sobre o **seed**, não invariante
do schema — ficava vermelha em todo banco onde alguém tivesse importado, que é o
trabalho normal. Substituída pelo invariante que sobrevive: toda linha tem origem
rastreável a uma importação.

- **Fixture não colide com dado real.** Prefixo reservado nos nomes, e-mails no TLD
  `.invalid`, escopo próprio. Fixture que colide aborta o arquivo antes da primeira
  asserção, e o erro que aparece não tem relação com o que se testava.
- **Asserção conta as próprias fixtures**, não a tabela inteira. `count(*) = 1`
  amarra o teste ao estado do banco.
- **O teste semeia o que precisa.** Depender de dado importado o torna vermelho em
  banco recém-instalado.

### 8.6 Varredura vence correção pontual

Quando um defeito é encontrado varrendo o schema em vez de lendo código, **a
varredura é o entregável, não a correção.** A instância corrigida era a única
naquele dia; a próxima nasce igual, e ninguém vai lembrar de varrer de novo.

Toda categoria de superfície privilegiada tem inventário declarado em teste: tabela
sem RLS, `TRUNCATE` concedido, view sem `security_invoker`, função
`SECURITY DEFINER` executável por `authenticated`, função alcançável por `anon`.
Item novo fora da lista quebra a suíte, e quem o adiciona declara por escrito por
que é seguro.

**A justificativa é "precisa ser chamável", nunca "é inofensivo".** Uma lista com
uma entrada justificada por ausência de dano vira uma lista com três, e aí deixa de
significar algo. Se o privilégio não serve para nada, revogue em vez de catalogar.

### 8.7 O ambiente concede mais do que qualquer migration escreve

A regra que as três ocorrências de privilégio herdado compartilham:

> **O que a imagem concede por padrão é mais amplo do que qualquer migration
> escreve, e nenhuma revogação genérica alcança.**

`alter default privileges` da imagem base concede a papéis nomeados — e
`revoke ... from public` **não** remove concessão nomeada; ela é entrada própria no
ACL. Vale para tabelas e para funções, e a segunda só foi descoberta porque a
primeira já tinha ensinado a procurar.

Privilégio é **declarado** no repositório, nunca herdado. E é medido em instalação
limpa, porque um banco que acumulou meses de trabalho descreve aquele banco, não o
schema.

### 8.8 Instalação limpa, em comando

Trabalhar semanas sobre o mesmo volume esconde defeitos: uma fixture passa por dado
que já estava lá, um privilégio parece declarado quando foi herdado, uma lista de
exceções descreve aquele banco.

O ensaio de instalação limpa é **um comando**, não uma sequência de passos: destrói
volumes, aplica todas as migrations em ordem, confere invariantes de base virgem,
roda a suíte e importa dado real pelas telas. Enquanto for sequência manual,
ninguém roda no começo da sprint seguinte — que é exatamente quando vale mais.

Pelas **telas**, e não por chamada direta: reimplementar a orquestração no script
faria o ensaio verificar a reimplementação em vez do código de produção.

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
