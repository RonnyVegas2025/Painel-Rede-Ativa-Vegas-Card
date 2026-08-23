# Painel Rede Vegas Ativa — especificação funcional e técnica

> Fonte de verdade do projeto. Não alterar regras essenciais sem aprovação explícita.
> Versão 2 — 31/07/2026. Substitui a versão "Rede Viva".

## 1. Objetivo
Sistema web responsivo, mobile-first, para a Gestão de Rede da Vegas Card selecionar uma
modalidade de cartão e uma cidade, visualizar somente os estabelecimentos elegíveis,
classificá-los pela última transação, organizar ações de campo, impedir visitas duplicadas,
registrar resultados e encaminhar pendências ou bloqueios para o administrativo.

## 2. Stack
Next.js + TypeScript (modo estrito, sem `any`) · Supabase (PostgreSQL, Auth, Storage,
Realtime, Edge Functions) · Tailwind CSS v4 · Vitest + pgTAP · GitHub · Vercel.

## 3. Regra de escopo
O MVP **não cadastra empresas clientes** que concedem cartões aos funcionários.
A unidade operacional é o **ponto credenciado**.

## 4. Arquitetura de código
- `src/features/<modulo>/` — domínio: componentes, serviços, validações, tipos, hooks, utils.
- `src/components/` — apenas `ui/`, `layout/` e `brand/`. Não conhece domínio.
- `src/lib/business-rules/` — funções puras de decisão. **Não leem o banco.** Recebem os
  parâmetros por argumento. É isso que as torna testáveis.
- `src/constants/` — valores e enums. **Nunca importa business-rules.**
- `src/hooks/` — apenas hooks transversais.
- Página do Next.js não calcula regra de negócio.

## 5. Modalidades e elegibilidade
`card_products.eligibility_mode` define o comportamento:

| Modo | Semântica | Modalidades iniciais |
|---|---|---|
| `all` | todos os segmentos ativos | Vegas Day, Plus |
| `allowlist` | somente segmentos com `rule_type = 'allow'` | Alimentação, Combustível, Farmácia, Refeição |
| `denylist` | todos, exceto `rule_type = 'deny'` | (reservado para uso futuro) |

`product_segments (card_product_id, segment_id, rule_type)` com **unicidade em
(card_product_id, segment_id)** — um par nunca tem duas regras, o que torna a contradição
impossível por construção. O campo `aceita_todos_segmentos` foi removido.

**Falha fechada:** segmento não mapeado nunca é elegível em modo `allowlist`. Fica na fila
de normalização em `/segmentos`.

Alterações na relação produto × segmento geram auditoria obrigatória.

## 6. Dimensões de status
Nunca um campo genérico `status`. Cinco dimensões independentes:

- **Cadastral:** `ativo` `bloqueado` `cancelado` `em_analise`
- **Transacional:** `recente` `atencao` `acao_necessaria` `critico` `nunca_transacionou`
- **Operacional:** `apto` `problema_tecnico` `fechado_temporariamente` `encerrado`
  `mudanca_proprietario` `mudanca_endereco` `equipamento_indisponivel`
  `bloqueio_solicitado` `suspenso` `em_reativacao`
- **Visita:** `reservada` `em_deslocamento` `checkin_realizado` `em_atendimento`
  `concluida` `cancelada` `expirada`
- **Ocorrência:** `aberta` `em_analise` `aguardando_informacao` `aprovada` `rejeitada`
  `resolvida` `cancelada`

`disponivel` **não é** status de visita: é a ausência de visita ativa, derivada em consulta.
Não existe linha em `visits` com esse valor.

Distinções que não podem se perder: `bloqueio_solicitado` não é bloqueio;
`suspenso` retira das listas de aptos temporariamente; `encerrado` é definitivo;
`fechado_temporariamente` não é encerramento; `em_reativacao` é tratativa em andamento.

## 7. Precedência do marcador no mapa
1. Indisponibilidade — `bloqueado` `suspenso` `encerrado` `cancelado`
2. Visita ativa — `reservada` `em_deslocamento` `checkin_realizado` `em_atendimento`
3. Pendência ou ocorrência — `problema_tecnico` `bloqueio_solicitado`
   `equipamento_indisponivel` `mudanca_proprietario` `mudanca_endereco`,
   ocorrência `aberta` ou `em_analise`
4. Transacional — faixas de recência

A cor principal segue essa ordem; o popup e o painel lateral exibem **todas** as dimensões
separadamente. Marcador nunca comunica só por cor: leva ícone, forma, borda e `aria-label`.

## 8. Exclusividade de visita — global por estabelecimento
Não pode existir mais de uma visita ativa por ponto credenciado, **mesmo em ações ou
modalidades diferentes**. Estados ativos: `reservada`, `em_deslocamento`,
`checkin_realizado`, `em_atendimento`.

Uma visita pode atender várias ações ao mesmo tempo: `visits` 1—N `visit_actions`.
O consultor faz numa ida só o teste de Farmácia, o de Vegas Day, a adesivação e a
atualização cadastral.

Garantia no banco por índice único parcial em `establishment_id` + advisory lock por
estabelecimento dentro da RPC. Nunca confiar no estado do botão. O supervisor pode
transferir ou cancelar; a criação de segunda visita simultânea exige exceção explícita
com justificativa registrada em auditoria.

## 9. Parâmetros configuráveis (`system_settings`)
`transaction_recent_days=30` · `transaction_attention_days=60` ·
`transaction_action_days=90` · `visit_reservation_minutes=60` ·
`checkin_radius_meters=200` · `consultant_location_update_seconds=60` ·
`maximum_active_reservations=3`

Nenhum número fixo em componente. Alteração conforme papel mínimo por chave, com auditoria.

## 10. Importação como sincronização
Receber → validar colunas → normalizar CNPJ/CEP/telefone/datas → identificar existentes →
inserir → atualizar → apontar duplicidades → registrar erros → relatório → histórico.
Registro ausente numa nova planilha **nunca é excluído**: vai para análise administrativa.
Datas em DD/MM/AAAA. `Nunca Transacionou` ⇒ `last_transaction_at = null`.

Identidade: contrato/ponto de captura externo. **CNPJ não é chave** — o mesmo CNPJ tem
vários endereços, contratos e terminais.

## 11. Perfis
`gestor_master` · `administrativo` · `supervisor_rede` · `consultor_campo` ·
`suporte_tecnico` · `comercial` · `consulta`

`comercial` vê cobertura, segmentos e indicadores agregados; não vê localização de equipe,
fotos, observações internas, ocorrências sensíveis, bloqueios nem auditoria.
`consulta` é somente leitura operacional, sem nenhuma escrita.
Matriz completa em `docs/permissions.md`.

## 12. Segurança
RLS em toda tabela operacional, desde a criação, com negação por padrão.
Papel no JWT via Custom Access Token Hook — policy nunca consulta `profiles` para
proteger `profiles`, sob pena de recursão infinita.
Policies separadas por comando; `for all` é proibido.
`(select auth.uid())` em vez de `auth.uid()` — avalia uma vez por consulta, não por linha.
Toda função `SECURITY DEFINER`: `set search_path = ''`, proprietário controlado, `execute`
revogado de `public`, argumentos validados, finalidade documentada.
Storage privado, signed URL de validade curta.
Localização de consultor legível apenas no contexto de ação ativa.

## 13. Rotas
`/login` `/dashboard` `/acoes` `/acoes/[id]` `/mapa` `/estabelecimentos`
`/estabelecimentos/[id]` `/minhas-visitas` `/atencao` `/importacoes` `/produtos`
`/segmentos` `/usuarios` `/relatorios` `/configuracoes`

## 14. Sprints
0. Fundação: estrutura, Next.js/TS/Tailwind, Supabase, migrations base, auth, perfis, RLS,
   parametrização, seeds, layout, componentes compartilhados, testes centrais, documentação.
1. Estabelecimentos e importação.
2. Classificação, geocodificação e mapa.
3. Ações, equipe, reserva atômica, check-in.
4. Visita, checklist e evidências.
5. Ocorrências, SLA e bloqueio.
6. Indicadores, auditoria e refinamento.

## 15. Critérios críticos
Farmácia não exibe postos · Vegas Day e Plus aceitam todos os segmentos ativos ·
duas visitas ativas no mesmo ponto são impossíveis · reserva expirada volta a disponível ·
resultado crítico gera ocorrência · importação não duplica · suspenso e bloqueado saem das
listas de aptos · mudanças críticas têm auditoria.

## 15a. Padrão visual da plataforma — obrigatório
Este projeto obedece ao **Vegas Platform UI Standard, versão 1.0**
(`docs/VEGAS-PLATFORM-UI-STANDARD.md`) e aos padrões globais em
`PLATFORM-STANDARDS.md`. Nenhum sistema Vegas cria identidade visual paralela.

Divergência do padrão exige ADR local com justificativa. Exceção silenciosa é erro.
Divergências conhecidas e o plano de alinhamento estão em `docs/ui-conformance.md`.

Versão consumida: **1.0**, aplicada em 03/08/2026. Também registrada em
`src/constants/app.ts` (`uiStandardVersion`). Atualização entra por versão, nunca por
cópia. Fonte canônica de tokens: `src/styles/tokens.css` — **único arquivo do projeto
que pode conter hexadecimal**.

## 15b. Visão de produto
Quatro pilares: operação de campo (sprints 1 a 5), central de atendimento (6 a 10),
inteligência da rede e inteligência comercial (evolução sem data). Health Score é
evolução prevista, dependente da origem transacional. Detalhe em `docs/roadmap.md`.

Disciplina que sustenta os pilares analíticos: **toda transição de estado é registrada
com o momento em que ocorreu**. Analítica não se retroage — dado não capturado hoje não
se reconstrói depois.

## 16. Instruções para o Claude Code
Antes de codificar cada sprint: resumir entendimento, listar dúvidas e riscos, apresentar o
plano, listar arquivos a criar ou alterar, **aguardar aprovação**.

Não cadastrar empresas clientes no MVP. Não alterar regra de negócio sem aprovação.
Não espalhar condicional de modalidade pelo código. Não coletar localização fora de ação
ativa. Não tratar cadastral `ativo` como confirmação operacional. Não permitir bloqueio
definitivo pelo consultor. Não usar `any`. Não deixar número mágico em componente.
