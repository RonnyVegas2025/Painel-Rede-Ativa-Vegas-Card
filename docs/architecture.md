# Arquitetura — Painel Rede Vegas Ativa

## Camadas

```
página (app/)          orquestra, busca dados, não decide
    ↓
feature (features/)    componentes e serviços do domínio
    ↓
business-rules (lib/)  função pura, sem I/O, testável
    ↓
constants (constants/) vocabulário e valores
```

A dependência é sempre para baixo. `constants` não importa nada do projeto.

## A regra que sustenta a testabilidade

Funções de `business-rules` **não leem o banco**. Recebem os parâmetros por argumento.

```ts
// certo — testável com 20 casos em milissegundos
calculateTransactionStatus(lastTransactionAt: Date | null, thresholds: RecencyThresholds)

// errado — precisa de banco para testar, e esconde a dependência
calculateTransactionStatus(establishment: Establishment)
```

Quem carrega `system_settings` é `src/lib/settings/get-settings.ts`, com cache de
requisição, e repassa os limites para baixo.

## Cliente Supabase

Três clientes, papéis distintos:

| Arquivo | Contexto | Chave |
|---|---|---|
| `lib/supabase/client.ts` | browser | anon |
| `lib/supabase/server.ts` | Server Component, Route Handler, Server Action | anon + cookies |
| `lib/supabase/middleware.ts` | renovação de sessão | anon |
| `lib/supabase/admin.ts` | worker e importação | service_role |

`admin.ts` importa `server-only` no topo. Se algum dia for importado num Client Component,
o build quebra em vez de vazar a chave de serviço para o navegador.

## Fluxo de autenticação

1. `middleware.ts` renova a sessão a cada requisição e protege as rotas do grupo `(dashboard)`.
2. O Custom Access Token Hook injeta `user_role` como claim no JWT no momento da emissão.
3. As policies leem o claim. Nenhuma policy consulta `profiles` para proteger `profiles`.
4. `require-role.ts` faz a segunda barreira no servidor. A interface esconder o botão é a
   terceira, e a menos importante.

Consequência operacional: mudar o papel de um usuário só surte efeito no próximo token.
Para efeito imediato, revogar a sessão. Está documentado no ADR 0005.

## Classificação por recência — SQL como fonte de verdade

O mapa filtra por área visível, então o filtro roda em SQL. A tela mostra o mesmo rótulo em
TypeScript. Duas implementações da mesma regra divergem com o tempo, então existe um teste
de paridade que roda o mesmo conjunto de casos contra as duas.

Detalhe técnico que restringe o desenho: a função SQL lê os limites de `system_settings`,
portanto é `STABLE`, não `IMMUTABLE`, e **não pode ser usada em índice**. O índice vai em
`last_transaction_at`; o filtro compara datas com os limites passados como parâmetro. Se
alguém tentar `create index on establishments (calculate_transaction_status(...))`, o
Postgres recusa — e está correto: se o limite mudar, um índice materializado ficaria mentindo.

## Fuso horário

Tudo em `timestamptz`. "Dias sem transação" é calculado em `America/Sao_Paulo`, senão uma
transação das 22h de ontem vira "hoje" ou "anteontem" dependendo do horário de verão do
servidor. A conversão é explícita em ambas as implementações e coberta pelo teste de paridade.

## Auditoria

Trigger genérico `fn_audit()` em `after insert/update/delete`, gravando em `audit_logs` via
função `SECURITY DEFINER`. Ninguém tem `update` nem `delete` em `audit_logs`, nem o
`gestor_master`. Log que pode ser editado não é log.

O IP não vem de `inet_client_addr()` — no Supabase isso devolve o endereço do pooler, igual
para todo mundo. Vem de `current_setting('request.headers', true)` quando disponível; caso
contrário fica nulo. Ver ADR sobre o assunto em `decisions/`.

## Realtime

`postgres_changes` respeita RLS, mas avalia as policies por evento e por assinante. Em mapa
com muitos consultores isso escala mal. A partir da Sprint 3, eventos de reserva e visita vão
por Broadcast a partir de trigger, com canal por ação — a decisão de autorização acontece uma
vez, na entrada do canal.

## Testes

| Alvo | Ferramenta |
|---|---|
| business-rules, utils, matriz de permissão | Vitest |
| paridade SQL × TypeScript | Vitest contra banco local |
| policy, constraint, função SQL, trigger | pgTAP |

Policy não se testa com Vitest. A verificação precisa acontecer dentro do banco, com o papel
assumido, ou não está verificando nada.

---

## Evolução prevista

O produto tem quatro pilares (ver `roadmap.md`). Os dois primeiros — operação de campo
e central de atendimento — estão no roadmap de sprints. Inteligência da rede e
inteligência comercial são evolução sem data.

Nada disso muda o que está construído. O que muda é uma disciplina que precisa ser
mantida a partir de agora, porque analítica não se retroage:

**Registrar toda transição de estado com o momento em que ocorreu.** Métrica como
"taxa de recuperação de estabelecimentos" ou "produtividade da equipe" depende de saber
quando cada coisa mudou. Estado atual sem trilha responde "como está", nunca "como
chegou aqui", e a trilha não se reconstrói depois.

Isso já está em vigor: `audit_logs` é somente-inserção, os endereços são históricos com
`is_current`, e as tabelas de histórico previstas para atendimento seguem o mesmo
padrão. A regra é não abrir exceção.

Quando os módulos analíticos chegarem, eles não devem consultar as tabelas operacionais
diretamente — painel com leitura pesada sobre tabela com RLS e escrita concorrente
degrada a operação de campo. O caminho é modelo de leitura próprio, pela mesma razão
que motivou `transaction_daily_metrics`.

**Health Score** é evolução prevista, dependente da origem transacional. Quando for
implementado, segue o princípio já aplicado a `transaction_status`, `disponivel` e
`sla_state`: **derivado, nunca gravado como fonte de verdade**, com pesos em tabela
parametrizável e composição visível na interface. Detalhamento em `roadmap.md`.
