# Vegas Platform UI Standard

**Documento normativo** — referência oficial de identidade visual dos sistemas
internos da Vegas. Cada projeto adapta o conteúdo funcional; nenhum cria identidade
visual paralela.

| | |
|---|---|
| Versão | **1.0** |
| Data | 03/08/2026 |
| Aplicação inicial | Painel Rede Vegas Ativa |
| Base visual | Logo oficial + VEGAS-DESIGN-SYSTEM.md + padrão de login aprovado |

> Cópia fiel do documento recebido, convertida para markdown. A versão consumida por
> este projeto está registrada no `CLAUDE.md`. Divergências entre esta cópia e o
> original valem a favor do original.

## 1. Objetivo e alcance

Estabelece a linguagem visual e de experiência dos sistemas internos da Vegas Card, para
que aplicações diferentes pareçam módulos de uma mesma plataforma.

Aplicável a Gestão de Rede, Agregados, Comercial, Credenciamento, Logística, Financeiro,
Parceiros e módulos futuros. As regras visuais são compartilhadas; as regras de negócio
continuam específicas de cada sistema.

Mudanças no padrão devem ser versionadas e propagadas de forma controlada.

**Princípio central:** o usuário alterna entre sistemas Vegas e reconhece a mesma
plataforma, sem reaprender navegação, formulários, tabelas ou feedback.

## 2. Filosofia de interface

Clareza antes de decoração. Cores claras e superfícies brancas como base. A marca
identifica navegação e autoria; status operacionais usam cores semânticas próprias.
Dados e ações críticas legíveis em ambiente administrativo, em campo e em monitor de
parede. Interface estável, discreta e profissional, sem modismos que envelheçam rápido.

## 3. Identidade visual oficial

| Grupo | Token | Hex | Uso |
|---|---|---|---|
| Marca primária | Brand 500 | `#4D56A1` | Botão primário, link, item ativo |
| Marca escura | Brand 800 | `#2C3164` | Painel institucional, títulos de alto contraste |
| Violeta | Brand 400 | `#6E68AE` | Início do gradiente e elementos de marca |
| Rosé | Rose 400 | `#9E7A9C` | Meio do gradiente; uso controlado |
| Pêssego | Peach 400 | `#D69086` | Fim do gradiente; uso decorativo restrito |
| Fundo | Background | `#F5F5FA` | Fundo geral da aplicação |
| Superfície | Surface | `#FFFFFF` | Cards, modais e tabelas |
| Texto | Ink | `#1C1F3B` | Texto principal |
| Texto secundário | Ink Secondary | `#494D6E` | Texto de apoio |

### 3.1 Correções obrigatórias antes da replicação

- Peach 600 de `#A85C4E` para aproximadamente `#9E5445`, garantindo AA sobre Peach 50.
- Criar `--vg-border-field` próximo de `#8E90AD` para bordas de input, mínimo 3:1.
- Label visível permanente em formulários; placeholder nunca substitui rótulo.
- Eliminar a nomenclatura ambígua `text-ink-muted`. Usar `ink-secondary` ou `muted`
  conforme a função.
- Evitar espelhos manuais de tokens. Havendo `brand.ts` ou JSON, criar teste de
  sincronização com a fonte canônica.

### 3.2 Gradiente institucional

90 graus, `#6E68AE` em 0%, `#9E7A9C` em 52%, `#D69086` em 100%. Assinatura visual
discreta, normalmente em faixa de 2 a 3 px.

**Permitido:** topo do login, item ativo da sidebar, progresso, etapa atual.
**Proibido:** fundo de card, botão principal, KPI, cabeçalho extenso, qualquer área
grande.

## 4. Tipografia

| Papel | Família | Peso | Uso |
|---|---|---|---|
| Display | **Outfit** | 400–600 | Títulos, cards e KPIs |
| Interface | **Inter** | 400–600 | Formulários, tabelas, texto e navegação |

### 4.1 Escala tipográfica oficial

| Token | Tamanho / linha | Uso |
|---|---|---|
| Display XL | 32 / 40 px | Título de login ou tela institucional |
| H1 | 24 / 32 px | Título principal de página |
| H2 | 20 / 28 px | Título de seção |
| H3 | 16 / 24 px | Título de card |
| Body | 14 / 22 px | Texto principal |
| Body Small | 13 / 20 px | Tabela e texto secundário |
| Caption | 12 / 18 px | Metadado, legenda e apoio |

Valores monetários, percentuais, protocolos e quantidades em tabela usam **algarismos
tabulares**.

## 5. Espaçamento, forma e profundidade

Spacing: 4, 8, 12, 16, 24, 32, 40, 48, 64 px.
Padding de card: 24 px desktop, 16 px mobile.
Gap entre campos: 16 px; entre seções: 32 px.
Raio: **6 px** pequeno, **10 px** padrão, **14 px** grande.
Card branco, borda de 1 px, sombra quase imperceptível.
Evitar card dentro de card — usar espaçamento, divisor ou fundo discreto.

## 6. Layout oficial

Sidebar, topbar, breadcrumb, cabeçalho de página e área de conteúdo. KPIs ou resumo
operacional antes do conteúdo principal.

### 6.1 Sidebar
Largura **248 px** expandida, **72 px** recolhida. Logo por componente único, nunca por
caminho de imagem solto. Item ativo: fundo Brand 50, texto Brand 700, faixa vertical de
gradiente de 3 px. Agrupadores em corpo pequeno, peso 600, caixa alta. No mobile,
navegação compacta ou drawer.

### 6.2 Topbar
Altura **64 px**. Ações à direita; contexto e breadcrumb à esquerda. Não transformar em
painel de botões. Em telas operacionais, mostrar estado de sincronização e última
atualização.

## 7. Padrão de login

A tela de Gestão ADM de Produtos Agregados é a referência visual.

Desktop dividido em duas áreas: institucional à esquerda, autenticação à direita.
Painel institucional em Brand 700/800, com título do sistema, mensagem de
confidencialidade e uso interno. Área de autenticação sobre fundo claro, com logo, nome
do sistema, texto de apoio, campos e botão primário. Faixa de gradiente de 2–3 px no
topo. No mobile, painel institucional oculto ou compactado.

Labels visíveis, botão Mostrar senha, erro próximo ao campo, versão no rodapé.

**Obrigatório:** o layout permanece igual entre projetos. Alteram-se apenas nome do
sistema, texto institucional, versão e recursos de autenticação.

## 8. Cabeçalho de página

Breadcrumb → título H1 → descrição de uma ou duas linhas → ação primária à direita →
secundárias em menu ou botões neutros. Nunca inverter breadcrumb e título.

## 9. Dashboards e KPIs

Gerencial: KPIs, gráficos, tabela, ações rápidas. Operacional: KPIs compactos, mapa ou
fila em destaque, alertas laterais. KPI contém rótulo, valor, contexto temporal e
comparação quando houver. A maior parte neutra; cor semântica só para sinalizar
situação. Números legíveis a distância em monitor de parede.

## 10. Cards

Título à esquerda, ações à direita. Sem gradiente de fundo, sem sombra pesada, sem
bordas decorativas múltiplas. Card clicável tem hover e foco visível.

## 11. Botões

| Variante | Aparência | Uso | Regra |
|---|---|---|---|
| Primário | Brand 500, texto branco | Ação principal | Uma por área de decisão |
| Secundário | Branco, borda forte | Ação alternativa | Sem competir com a primária |
| Neutro | Fundo claro | Apoio | Uso recorrente |
| Perigo | Danger | Excluir, bloquear, cancelar | Confirmar quando irreversível |
| Texto | Sem caixa | Ação discreta | Evitar em operações críticas |

## 12. Formulários

Label sempre visível acima do campo. Borda em `--vg-border-field`. Ajuda contextual
abaixo do campo; erro no mesmo local, em linguagem objetiva. Campos agrupados por seção,
sem excesso de modais. Ações no final; barra fixa opcional em formulários longos. Alvo
de toque mínimo 44 px no mobile. Placeholder nunca é a única instrução.

## 13. Tabelas e listas

Cabeçalho com fundo Surface Muted e texto Ink Secondary. Colunas numéricas à direita;
status e datas curtas centralizados. Pesquisa, filtros, exportação e paginação pelo mesmo
componente. Linha clicável precisa de affordance visual. Ações por registro no fim da
linha ou em menu contextual. No mobile, cards resumidos ou rolagem controlada.

## 14. Badges e estados

Marca e status não compartilham significado. Violeta indica Vegas e navegação; status usa
escala semântica.

| Categoria | Exemplos | Fundo | Texto |
|---|---|---|---|
| Sucesso | Ativo, concluído, aprovado | `#E4F4EE` | `#1F7A5C` |
| Atenção | Pendente, aguardando | `#FDF3E2` | `#9A6410` |
| Perigo | Erro, cancelado, bloqueado | `#FBEAEC` | `#B03A45` |
| Informação | Em trânsito, informativo | `#F0F0F8` | `#434B8F` |
| Neutro | Rascunho, encerrado | `#EEEEF4` | `#5A5E7A` |
| Parcial | Estado intermediário | `#F7F0F6` | `#7A5A78` |
| Suspenso | Cortesia ou suspensão | `#FBF0ED` | `#9E5445` |

## 15. Modais, drawers e confirmações

Modal pequeno para confirmação; drawer para edição contextual; página completa para
fluxos longos. Título, descrição, conteúdo, rodapé com ações. Ação de perigo à direita.
Esc fecha quando seguro; bloquear fechamento acidental com alteração não salva. Nunca
empilhar modais.

## 16. Feedback, loading e estados vazios

Skeleton quando a estrutura é conhecida. Spinner só para ações curtas e localizadas.
Toast para confirmação transitória; erro importante permanece na tela. Empty state
explica por que não há dados e qual o próximo passo. Forbidden state não parece erro
técnico. Offline e dado desatualizado são explícitos.

## 17. Padrão para mapas

Mapa é ferramenta operacional, não decoração. Marcadores comunicam por cor, ícone e
contorno; **nunca somente por cor**. Legenda sempre visível ou acessível. Filtros por
produto, cidade, status e equipe próximos ao mapa. Cluster obrigatório em áreas densas.
Painel lateral com detalhes, ações e histórico. Localização do consultor com estado de
precisão, atualização e permissão.

## 18. Central de monitoramento

Rota própria em tela cheia, sem sidebar. Tipografia ampliada para leitura a cerca de 3
metros. Relógio de última atualização e indicador de dados desatualizados. Renovação
silenciosa de sessão. Realtime com fallback periódico. Prioridades ordenadas por posição,
texto e ícone. Evitar excesso de movimento.

## 19. Responsividade

| Contexto | Prioridade | Comportamento |
|---|---|---|
| Desktop administrativo | Densidade e produtividade | Sidebar, tabelas, filtros, múltiplas colunas |
| Tablet | Consulta e supervisão | Menus compactos, painéis adaptáveis |
| Mobile em campo | Ação com uma mão | Botões 44 px, fluxo linear, câmera, geolocalização |
| Monitor de parede | Leitura à distância | Tela cheia, tipografia grande, sem interação constante |

## 20. Acessibilidade

Contraste WCAG AA para texto e **3:1 para limites de componentes interativos**. Foco
visível em todos os controles. Navegação completa por teclado no desktop. Labels e nomes
acessíveis em ícones e botões. **Não comunicar status apenas por cor.** Respeitar
`prefers-reduced-motion`. Toque mínimo 44 px. Tabelas com cabeçalho semântico.

## 21. Ícones, imagens e logo

Biblioteca padrão: **Lucide**. Não misturar bibliotecas de ícones no mesmo sistema.
Logo por componente único, com variantes completa, compacta e monocromática. Caminhos de
ativos centralizados em configuração de marca. Priorizar SVG oficial; PNG provisório até
obter o vetor.

## 22. Padrões de página

**CRUD:** lista com filtros e ação Novo → formulário ou detalhe em seções →
confirmação de exclusão ou inativação → histórico quando auditável.

**Analítica:** filtros de período e escopo → KPIs → gráficos → tabela detalhada →
exportação e última atualização.

**Operacional:** fila priorizada → contexto e responsável → ação principal visível →
SLA ou tempo decorrido → linha do tempo e evidências.

## 23. Componentes oficiais

`VegasLogo` `VegasAppShell` `VegasSidebar` `VegasTopbar` `VegasPageHeader` `VegasButton`
`VegasInput` `VegasSelect` `VegasTextarea` `VegasCard` `VegasKpi` `VegasBadge`
`VegasTable` `VegasFilters` `VegasModal` `VegasDrawer` `VegasToast` `VegasEmptyState`
`VegasErrorState` `VegasSkeleton` `VegasTimeline` `VegasMap` `VegasAlert`
`VegasMonitorCard`

Catálogo conceitual. A implementação pode usar nomes sem o prefixo dentro de uma
biblioteca compartilhada, desde que documentação e API sejam consistentes.

## 24. Regras de implementação

- Hexadecimal **somente** no arquivo canônico de tokens.
- Componente não referencia caminho de logo diretamente.
- Estado semântico não usa cor de marca por conveniência.
- Tokens CSS são a fonte canônica; JSON e TypeScript são gerados ou testados contra ela.
- Componente novo inclui default, hover, focus, active, disabled, loading e erro.
- Toda mudança relevante inclui documentação e teste visual.

## 25. Governança e sincronização

Com poucos sistemas: documento versionado, versão registrada em cada repositório.
Com três ou mais sistemas ativos: pacote privado `@vegas/tokens`.
Quando a biblioteca de componentes estabilizar: avaliar `@vegas/ui`.
Mudança de token ocorre primeiro na fonte canônica, com registro da decisão.
Projetos consumidores atualizam por versão, **nunca por cópia silenciosa**.

## 26. Aplicação ao Painel Rede Vegas Ativa

Login segue o padrão institucional aprovado em Agregados. Dashboard operacional prioriza
mapa, fila de atenção, visitas e alertas. Status de estabelecimentos mantém cores
operacionais próprias, sem substituir a paleta institucional. Central de monitoramento em
modo de parede. Formulários de atendimento, visita e ocorrência reutilizam o mesmo padrão
de campos, histórico e anexos.

O projeto registra em seu `CLAUDE.md` a obrigatoriedade de obedecer a este documento.

## 27. Checklist de conformidade

- [ ] Logo entra por componente único
- [ ] Tokens corrigidos de contraste aplicados
- [ ] Nenhum hexadecimal em componente
- [ ] Outfit e Inter configuradas
- [ ] Escala de spacing e tipografia adotada
- [ ] Login segue o padrão oficial
- [ ] Sidebar e topbar seguem a arquitetura oficial
- [ ] Botões com variantes padronizadas
- [ ] Inputs com `border-field` e label visível
- [ ] Status não usam cor de marca
- [ ] Tabelas, modais e empty states em componentes compartilhados
- [ ] Responsividade validada em desktop, mobile e monitor
- [ ] Contraste AA e foco por teclado testados
- [ ] Documentação registra a versão consumida

## 28. Controle de versão

| Versão | Data | Mudança | Responsável |
|---|---|---|---|
| 1.0 | 03/08/2026 | Criação do padrão oficial da Plataforma Vegas | Gestão Comercial / Projetos Internos |
