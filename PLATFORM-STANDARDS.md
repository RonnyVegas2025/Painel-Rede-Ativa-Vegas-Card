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
