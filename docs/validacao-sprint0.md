# Validação da Sprint 0 em ambiente real

Execução das 12 verificações de `docs/setup-validation.md` com o stack no ar.
Data: 23/08/2026.

As migrations já tinham sido conferidas com o parser do PostgreSQL. O que só o
banco no ar provou está marcado abaixo — e foi justamente ali que apareceram os
nove defeitos.

## Ambiente

| Item | Versão |
|---|---|
| Node | 22.22.2 |
| Supabase CLI | 2.115.0 |
| PostgreSQL | 15 (imagem `supabase/postgres:15.8.1.085`) |
| Next.js | 15.5.23 |
| Navegador | Chromium 1194, via Playwright |

Stack local subiu sem os contêineres de log (`vector`, `logflare`) e sem
`studio`, `imgproxy`, `mailpit`, `supavisor`, `edge-runtime`, `storage-api`.
Nenhum deles participa das 12 verificações. `vector` pede `nofile` acima do teto
do host usado e derrubava o `supabase start` inteiro.

## Resultado

| | Verificação | Resultado |
|---|---|---|
| V1 | 10 migrations na ordem | passou |
| V2 | 7 tabelas · `disponivel` ausente · unicidade sem `rule_type` | passou |
| V3 | seeds 6 / 13 / 15 / 7 | passou |
| V4 | Farmácia sem posto · Vegas Day com tudo | **passou** |
| V5 | claim do JWT coincide com o perfil | passou, **após B-2** |
| V6 | nenhuma policy `FOR ALL` · `audit_logs` sem escrita | passou |
| V7 | consultor não altera parâmetro | passou, **após B-1** |
| V8 | consultor não se promove, mas edita o próprio nome | passou, **e após B-4** |
| V9 | auditoria grava alteração de parâmetro | passou |
| V10 | login, redirecionamentos e mensagem de erro | passou, **após B-6** |
| V11 | diagnóstico com seis linhas verdes | passou, **após B-1** |
| V12 | 268 Vitest · typecheck · lint · 4 pgTAP | passou, **após B-3, B-5, B-7** |

Doze de doze, com nove correções pelo caminho. Nenhum defeito em aberto.

### V4 — o critério de aceite número um

```
Farmácia   -> Drogaria, Farmácia          (sem Posto de combustível)
Vegas Day  -> os 13 segmentos
```

Contagem por modalidade: Alimentação 8 · Combustível 1 · Farmácia 2 · Plus 13 ·
Refeição 4 · Vegas Day 13. Os vínculos somam 15, que é o total de
`product_segments`.

### V5 — o hook

Verificado por dentro do token emitido, não só pela linha do `/diagnostico`:

```
gestor     user_role = "gestor_master"
consultor  user_role = "consultor_campo"
comercial  user_role = "comercial"
```

### V7 e V8 — RLS pelo caminho real

`PATCH /rest/v1/system_settings` com token de consultor devolve `[]` e o valor
segue 200. `PATCH /rest/v1/profiles` com `role` devolve
`Alteracao de papel exige gestor_master`; com `full_name` funciona; contra a
linha de outro usuário devolve `[]`.

As contraprovas importam tanto quanto os testes: o consultor **lê** os
parâmetros e o gestor master **altera**. Sem elas, indisponibilidade se
disfarça de política — ver B-1.

## Defeitos encontrados

### B-1 — Nenhuma tabela concede privilégio aos papéis do PostgREST · **crítico**

`select ... from information_schema.role_table_grants` devolvia, para as sete
tabelas, nada de `SELECT`, `INSERT`, `UPDATE` ou `DELETE` a `authenticated` e
`service_role` — apenas `REFERENCES, TRIGGER, TRUNCATE`.

Toda chamada à API respondia `42501 permission denied for table X`, para
qualquer papel, gestor master incluído. As policies da 0009 eram código morto: o
`grant` nega antes de a RLS ser avaliada.

Causa: as imagens atuais do Supabase deixaram de conceder DML por
`alter default privileges` no schema `public`. O ACL efetivo passou a ser
`{anon=Dxt, authenticated=Dxt, service_role=Dxt}` — `Dxt` é TRUNCATE,
REFERENCES e TRIGGER. Como `anon` recebia TRUNCATE, e TRUNCATE ignora RLS,
`audit_logs` era apagável por um papel anônimo.

O detalhe que mais incomoda: **V7 e V8 passavam pelo motivo errado.** Confirmar
que o consultor *não* altera parâmetro fica verde quando ninguém altera coisa
alguma.

Corrigido em `20260823000011_table_grants.sql`, que revoga o herdado e concede
exatamente os comandos que têm policy. `anon` fica sem nada, por ausência
deliberada.

### B-2 — `config.toml` desligava o login inteiro · **crítico**

`[auth.email] enable_signup = false` gerava `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`:
a CLI deriva o provedor de e-mail dessa chave, e não de um campo próprio. Com o
banco perfeito, `/login` respondia *"Email logins are disabled"*.

Quem desliga o autosserviço é o `enable_signup` da seção `[auth]`, que vira
`GOTRUE_DISABLE_SIGNUP=true` — e continua ligado. Corrigido em `config.toml`,
com o porquê no próprio arquivo.

### B-3 — `lucide-react` não declarado · **impede o build**

Importado por `nav-items.ts`, `topbar.tsx`, `forbidden-state.tsx` e
`page-header.tsx`, ausente do `package.json`. Quatro erros `TS2307`. Declarado
em `^0.460.0` — é a biblioteca que o UI Standard torna obrigatória, então isto é
restaurar declaração ausente, não adicionar dependência.

### B-4 — Não havia como criar o primeiro gestor master · **crítico**

O passo 5 de `setup-validation.md` manda rodar, no SQL Editor:

```sql
update public.profiles set role = 'gestor_master' where email = 'gestor@vegas.local';
```

Falha com `Alteracao de papel exige gestor_master`. A trigger
`fn_protect_profile_fields` só libera para quem `auth_role()` reconhece como
gestor master, e `auth_role()` lê o JWT — que não existe em conexão direta, onde
ela devolve `consulta` (o padrão seguro do ADR 0005, correto em si). Trigger não
é RLS: superusuário não passa por cima.

Instalação nova nasce sem administrador e sem caminho para criar um.

O ponto de fundo: **qualquer um com acesso direto ao banco já contornava a
trigger em uma linha**, com
`set_config('request.jwt.claims', '{"user_role":"gestor_master"}', true)`. A
barreira nunca protegeu contra conexão direta — apenas travava o procedimento
documentado.

Corrigido em `20260823000013_profile_bootstrap.sql`: a exceção passa a cobrir
também a ausência de contexto PostgREST, que é o que caracteriza acesso direto.
Isso não afrouxa a proteção, torna-a honesta.

Pela API nada muda, e foi verificado: consultor autenticado recebe
`Alteracao de papel exige gestor_master`; **`service_role` também**, porque seu
token traz claims sem `user_role` e portanto não alcança a exceção; e mudar o
próprio nome continua funcionando. O passo 5 do guia agora roda como está
escrito.

### B-5 — `@supabase/ssr` incompatível com `supabase-js` · **impede o typecheck**

23 erros `Property 'x' does not exist on type 'never'` e `cookiesToSet`
implicitamente `any`. Sondagem do tipo revelou
`PostgrestQueryBuilder<{PostgrestVersion:"12"}, never, ...>` — o Schema chegava
como `never`.

`@supabase/ssr@0.5.2` chama `SupabaseClient<Database, SchemaName, Schema>`
posicionalmente; `supabase-js@2.112` inseriu `ClientOptions` antes de
`SchemaName`. Os intervalos `^0.5.2` e `^2.45.4` deixaram o `supabase-js` andar
de 2.45 a 2.112 enquanto o `ssr` ficou parado, e o contrato de tipos quebrou.

`@supabase/ssr` para `^0.12.4`; piso do `supabase-js` elevado a `^2.112.3`, que é
o par efetivamente testado junto. `package-lock.json` passa a ser versionado — o
CI roda `npm ci`, que exige lockfile e falhava sem ele.

### B-6 — O middleware nunca rodava · **crítico**

`middleware.ts` estava na raiz do repositório. Com o projeto usando `src/app`, o
Next.js exige `src/middleware.ts`. Na raiz, ao lado de `src/`, o arquivo não é
carregado: o build não imprimia `ƒ Middleware` e
`.next/server/middleware-manifest.json` trazia `middleware: []`.

O sintoma visível era pequeno — `/dashboard` sem sessão redirecionava para
`/login` em vez de `/login?proximo=/dashboard`, reprovando a V10.3. O de fundo
não é: **a sessão nunca era renovada.** O `@supabase/ssr` depende do middleware
para renovar o token e regravar os cookies; sem ele o usuário cai fora quando o
token expira, em uma hora, em vez de renovar em silêncio. O comentário do
`server.ts` — "o middleware já renovou a sessão antes de chegar aqui" — era
premissa falsa.

E a proteção de rota ficava só no `requireProfile()` do layout, que o próprio
projeto descreve como segunda barreira.

Movido para `src/middleware.ts`. O build passou a registrar `ƒ Middleware`
93,2 kB e a V10.3 devolve `/login?proximo=%2Fdashboard`.

### B-7 — `is_segment_eligible` não falhava fechada · **regra de negócio**

pgTAP `01_helpers_and_enums.sql`, teste 9: `is_segment_eligible('allowlist', null)`
devolvia **NULL**, não `false`.

O comentário na própria 0008 declara a intenção — `-- nulo => falso: falha
fechada` — e o operador entrega outra coisa: `p_rule = 'allow'` com nulo devolve
nulo, lógica de três valores. A linha do `denylist` logo abaixo já usava
`is distinct from`, o operador certo.

Por que passou despercebido: o único consumidor hoje é `eligible_segments`, que
chama a função dentro de um `WHERE`, e ali NULL descarta a linha igual a `false`.
**A V4 passa corretamente hoje, mas pelo contexto da chamada, não pela função.**
Basta o primeiro `if not is_segment_eligible(...)` ou um `!elegivel` do lado
TypeScript para a falha fechada virar aberta — que é o que o ADR 0003 proíbe.

Corrigido em `20260823000012_segment_eligibility_fail_closed.sql`.

### B-8 — O teste pgTAP de bordas estava errado, não a função

`04_transaction_status_parity.sql` reprovava as três bordas (30, 60 e 90 dias),
acusando `calculate_transaction_status`. A função está correta e é idêntica à
gêmea TypeScript.

O teste construía a entrada como `(now() at time zone 'America/Sao_Paulo')::date - 30`,
um `date`. Convertido para `timestamptz`, o Postgres interpreta meia-noite no
fuso do servidor — UTC no contêiner — e a função, ao voltar para
`America/Sao_Paulo` (UTC−3), cai no dia anterior. Medido: 31 dias onde o teste
escrevia 30.

Entrada passou a ser `::timestamp at time zone 'America/Sao_Paulo'`, que fixa o
instante no fuso do negócio. Os 43 testes pgTAP passam.

### B-9 — `npm run lint` falhava depois de um build

`next-env.d.ts` é gerado pelo `next build`, está no `.gitignore` e carrega uma
triple-slash reference que a própria regra do Next reprova. O `eslint.config.mjs`
ignorava `.next/**` mas não ele.

No CI passava, porque lá o lint roda antes de qualquer build e o arquivo não
existe. Na máquina de quem tinha acabado de compilar, falhava. Adicionado aos
`ignores`. De quebra, o `export default` anônimo — único aviso restante da suíte
— passou a ser nomeado.

## Pós-validação — o que mudou depois

Quatro itens executados após o aceite do relatório.

### O teste de paridade não testava paridade — corrigido

`PLATFORM-STANDARDS.md` §8 prevê "paridade entre implementação SQL e TypeScript ·
Vitest contra banco local". O que existia eram duas listas de casos, uma em
Vitest e outra em pgTAP, cada uma comparando com expectativas escritas à mão, mais
uma asserção de "mesma quantidade de casos". As duas metades nunca se
encontravam — foi por isso que B-7 e B-8 conviveram com suíte verde.

Substituído por um arnês genérico (ADR 0010): mesma entrada nas duas
implementações, saídas comparadas entre si, sem expectativa no meio. As entradas
vivem em `tests/fixtures/`, sem valor esperado. Os testes de valor esperado
sobre a função TypeScript continuam em `tests/unit/` — paridade prova que as duas
concordam, não que estão certas.

Verificado que o arnês pega o que promete: trocando `<=` por `<` na faixa recente
da função SQL, ele acusa exatamente as duas bordas afetadas, com os dois valores
lado a lado (`{ sql: 'atencao', ts: 'recente' }`). E com o banco fora do ar ele
**falha**, não pula.

Genérico porque o ADR 0001 persiste o hash do endereço normalizado: a Sprint 1
vai criar uma gêmea SQL de `normalizeAddress`, e divergência de um hífen ali
duplica pontos credenciados sem conserto que não passe por migração de dados.

### Privilégio durável para tabelas futuras

A 0011 concedeu tabela a tabela. Confirmado com o banco no ar que uma tabela nova
ainda nasceria com `REFERENCES, TRIGGER, TRUNCATE` para os três papéis — `anon`
incluído — e nenhum DML: o mesmo defeito voltaria na primeira tabela da Sprint 1.

A 0014 declara o privilégio padrão do schema. O `05_grants_and_rls.sql` varre o
schema inteiro, sem citar nome de tabela, e falha se alguma ficar sem RLS, com
TRUNCATE indevido, com privilégio para `anon` ou com policy sem o grant
correspondente. Cada uma das quatro asserções foi verificada introduzindo o
defeito que ela promete pegar.

### TRUNCATE em `authenticated`

Já estava coberto: o `revoke all` da 0011 alcançou os três papéis, não só `anon`.
Confirmado por consulta e agora travado pelo teste acima.

### Promoção de papel não passa por `service_role`

Registrado no ADR 0005 (Consequências) e em `permissions.md`: a tela de gestão de
usuários terá que promover papel com o JWT do gestor master. O token de
`service_role` não carrega `user_role`, então `auth_role()` cai para `consulta` e
a trigger recusa — comportamento pretendido, porque `service_role` ignora RLS.

## Contraste na plataforma — o que o Agregados mostra

`ui-conformance.md` já registrava que a referência de Agregados usa `#A0A2C3`
para o texto de apoio do painel institucional, com 3,73:1 sobre Brand 700, e
sugeria reportar à governança. O repositório de Agregados foi conferido.

O `#A0A2C3` não existe lá. O que existe é o mesmo problema em lugar pior:

| Token | Valor | Sobre branco | Sobre `--vg-bg` |
|---|---|---|---|
| `--vg-border` | `#e5e5f0` | **1,25:1** | 1,15:1 |
| `--vg-border-strong` | `#cfcfe2` | **1,54:1** | 1,41:1 |
| `--vg-placeholder` | `#9da0b8` | **2,58:1** | — |

`src/components/ui/input.tsx` do Agregados usa `border border-line`, e `line`
mapeia para `--vg-border`. **A borda real dos campos em produção mede 1,25:1**,
onde a norma exige 3:1 — pior que o `#C9C9D8` (1,64:1) que este projeto tratou
como defeito. `--vg-placeholder` reprova em AA para texto.

Não é problema deste repositório, e não foi alterado aqui. É item para a
governança do padrão: a decisão vale para a plataforma, e um projeto não deve
corrigir token de outro por conta própria (`PLATFORM-STANDARDS.md` §10).

Reportado em `RonnyVegas2025/Painel-Gest-o-de-Agregados` **issue #4**, com os
valores medidos e a sugestão de separar a borda de campo da borda decorativa.

## Como reproduzir

```bash
supabase start -x vector,logflare,supavisor,imgproxy,mailpit,studio,edge-runtime,storage-api
npm run db:types
npm run check       # typecheck · lint · 254 testes, sem banco
npm run db:test     # 4 arquivos pgTAP, 36 testes
npm run test:parity # 22 casos de paridade SQL x TypeScript
npm run build && npm run start
```

Usuários de teste conforme o passo 5, com a linha do `set_config`.
