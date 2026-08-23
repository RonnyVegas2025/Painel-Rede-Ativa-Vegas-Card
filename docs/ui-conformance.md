# Conformidade com o UI Standard 1.0

**Status: alinhamento concluído em 03/08/2026.** Padrão consumido: **1.0**.
Este documento registra o que foi ajustado e as decisões tomadas no caminho.

## Resultado

| Verificação | Resultado |
|---|---|
| Contraste de todos os pares de token | 17 pares, todos aprovados |
| Hexadecimal fora de `styles/tokens.css` | nenhum |
| Nomenclatura `ink-muted` | eliminada |
| Testes automatizados | 268, todos passando |
| Typecheck estrito | limpo |

## Defeitos corrigidos

### 1. Borda de campo sem contraste
`--color-border-strong` `#C9C9D8` media **1,64:1** contra branco, onde a norma exige
3:1 (§20). O campo ficava praticamente sem contorno em monitor de baixo contraste ou
sob sol.

A §3.1 sugere "próximo de `#8E90AD`". Esse valor dá 3,11:1 sobre branco, mas apenas
**2,87:1 sobre `--vg-background`** — e campos também aparecem sobre o fundo da
aplicação, não só sobre superfície branca. Adotado `#8587A6`: 3,49:1 sobre branco e
3,21:1 sobre o fundo.

### 2. Texto de apoio do painel institucional
A cor amostrada da referência de Agregados, `#A0A2C3`, mede **3,73:1** sobre Brand 700
e reprova em AA. É o parágrafo de confidencialidade da tela de entrada — justamente o
que precisa ser lido. Clareado para `#BABCD6`, que dá 4,97:1 sem achatar a hierarquia
contra o título em branco.

> Vale reportar à governança do padrão: a referência visual oficial contém esse
> contraste. Outros sistemas que a copiarem herdam o problema.

### 3. Violação da regra de dependência entre camadas
`constants/transaction-status.ts` importava o tipo `BadgeTone` de
`components/ui/badge.tsx`. O `PLATFORM-STANDARDS.md` §3 diz que a dependência é sempre
para baixo e que `constants` não importa nada do projeto — o typecheck estrito expôs.
O tipo passou para `constants/badge-tones.ts`; o componente importa de lá.

Um teste passou a verificar isso em toda a pasta `constants`.

## Decisões tomadas

**Tokens canônicos em `--vg-*`, Tailwind por alias.** `src/styles/tokens.css` não tem
nada específico deste projeto: quando `@vegas/tokens` existir, sai daqui sem uma linha
de alteração. O `globals.css` só reexporta em `--color-*` dentro de `@theme`, que é o
que o Tailwind v4 exige para gerar utilidades.

**Sem família monoespaçada.** A norma define apenas Outfit e Inter. Inter tem
algarismos tabulares de verdade, que é o que sustenta a conferência dígito a dígito de
CNPJ contra a fachada. A classe `.identificador` continua existindo, agora apoiada em
`tabular-nums`. Uma fonte a menos para carregar em 4G de campo.

**Badges na escala semântica, marcadores na rampa própria.** Os sete pares do §14 são
usados integralmente em badge. O mapa mantém a rampa operacional, permitido pelo §26.
O motivo é medido: o par Informação (`#434B8F`) fica a **1,20:1** do Brand 500 — como
badge sobre fundo próprio funciona (7,01:1), como preenchimento de marcador ao lado da
navegação seria indistinguível, que é o que o §14 proíbe. Por isso "reservado" é ciano:
separa por matiz, não por luminância, o que é o que resolve em 12 px sob sol.

Um teste verifica que nenhuma cor da rampa é a cor da marca e que reservado mantém
distância de matiz.

## Diferenças em relação à referência de Agregados

| Item | Referência | Aqui | Motivo |
|---|---|---|---|
| "Esqueci minha senha" | presente | ausente | não há fluxo de recuperação: acesso é criado pelo gestor (`enable_signup = false`). Entra quando o fluxo existir |
| Faixa de gradiente | 4 px sobre o painel | igual | — |
| Proporção das áreas | 44% / 56% | igual | — |
| Texto de apoio | `#A0A2C3` | `#BABCD6` | contraste, ver acima |

## Evidências

`docs/evidencias/` traz login desktop e mobile, painel com sidebar expandida e
recolhida. Renderizadas a partir de `styles/tokens.css`, não de valores copiados.

## Checklist do §27

- [x] Logo entra por componente único, com variantes `full`, `mark` e `mono`
- [x] Tokens corrigidos de contraste aplicados
- [x] Nenhum hexadecimal em componente
- [x] Outfit e Inter configuradas
- [x] Escala de spacing e tipografia adotada
- [x] Login segue o padrão oficial
- [x] Sidebar 248/72 px e topbar 64 px
- [x] Botões com as cinco variantes do §11
- [x] Inputs com `border-field` e label visível
- [x] Status não usam cor de marca
- [x] Empty, error e forbidden state em componentes compartilhados
- [x] Responsividade validada em desktop e mobile
- [x] Contraste AA e foco visível verificados por teste
- [x] Versão consumida registrada no `CLAUDE.md` e em `constants/app.ts`
- [ ] Tabelas e modais — entram quando houver tela que os use (Sprint 1)
- [ ] Monitor de parede — Sprint 10
