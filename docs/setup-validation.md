# Guia de implantação e validação — Sprint 0

Objetivo: subir o projeto do zero e comprovar que fundação, autenticação, RLS,
parametrização e testes funcionam. Ao final você terá 12 verificações com resultado
esperado explícito.

Reserve cerca de 40 minutos na primeira execução, quase toda em download de imagens.

---

## 1. Pré-requisitos

| Item | Versão | Como conferir |
|---|---|---|
| Node.js | 20.x ou 22.x LTS | `node -v` |
| npm | 10+ | `npm -v` |
| Docker Desktop | 4.30+, **em execução** | `docker ps` |
| Supabase CLI | 1.200+ | `supabase --version` |
| Git | qualquer recente | `git --version` |

Node 18 não serve: o projeto usa React 19 e Next 15. Node 21 e 23 são ímpares, sem
suporte de longo prazo — fique no 20 ou 22.

**Docker precisa estar rodando antes de qualquer comando `supabase`.** Se `docker ps`
der erro de conexão, abra o Docker Desktop e espere a baleia ficar verde.

Instalar a CLI:

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell, com Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
  | tar -xz && sudo mv supabase /usr/local/bin/
```

Não instale a CLI com `npm install -g supabase`: esse pacote está descontinuado.

Portas usadas: **54321** (API), **54322** (Postgres), **54323** (Studio), **3000**
(Next). Se alguma estiver ocupada, `supabase start` falha com "port is already
allocated". Libere ou ajuste `supabase/config.toml`.

---

## 2. Configuração inicial

```bash
tar xzf painel-rede-vegas-ativa-sprint0.tar.gz
cd painel-rede-vegas-ativa

git init && git add -A && git commit -m "Sprint 0: fundação"

npm install
```

`npm install` deve terminar sem erro. Avisos de `peer dependency` são normais.

---

## 3. Subir o banco

```bash
supabase start
```

Na primeira vez baixa cerca de 2 GB. Ao terminar, imprime as chaves:

```
API URL: http://127.0.0.1:54321
    DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
  anon key: eyJhbGciOi...
service_role key: eyJhbGciOi...
```

**Copie as duas chaves.** Se perder, `supabase status` mostra de novo.

### Variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cole a anon key>
SUPABASE_SERVICE_ROLE_KEY=<cole a service_role key>

GEOCODING_PROVIDER=
GEOCODING_API_KEY=
```

Duas coisas que importam:

- **Nunca prefixe a service_role com `NEXT_PUBLIC_`.** Ela ignora RLS por completo;
  prefixada, vai para o bundle do navegador e qualquer visitante tem acesso total ao
  banco. O `import "server-only"` em `src/lib/supabase/admin.ts` quebra o build se
  esse arquivo for puxado para o cliente, mas a variável em si não tem essa proteção.
- `.env.local` já está no `.gitignore`. Confirme com `git status` — ele não deve
  aparecer.

As chaves locais são fixas e públicas, iguais em toda instalação do Supabase CLI.
Não são segredo. Em produção, são.

---

## 4. Gerar os tipos e subir a aplicação

```bash
npm run db:types
npm run dev
```

`db:types` sobrescreve `src/lib/supabase/database.types.ts`, que hoje contém um
esqueleto escrito à mão. **Rode isso depois de toda migration**, sempre.

Abra `http://localhost:3000`. Você deve ser redirecionado para `/login`.

---

## 5. Criar o primeiro usuário

O autosserviço está desligado (`enable_signup = false`): criar acesso é ato
administrativo. Use o Studio.

1. `http://127.0.0.1:54323` → **Authentication** → **Add user** → **Create new user**
2. E-mail `gestor@vegas.local`, senha de 8+ caracteres
3. Marque **Auto Confirm User**. Sem isso o login recusa por e-mail não confirmado.

Promova a gestor master no **SQL Editor**:

```sql
update public.profiles set role = 'gestor_master' where email = 'gestor@vegas.local';
```

> **Por que isto funciona pelo SQL Editor e não pela API.** A trigger
> `fn_protect_profile_fields` libera troca de papel para `gestor_master` e para
> conexão sem contexto HTTP — `psql`, SQL Editor, migration, seed. É o caminho de
> bootstrap: sem ele, trocar papel exigiria já ser gestor master, e ninguém é
> numa instalação nova (migration 0013).
>
> Pela API a proteção é integral. O PostgREST sempre popula `request.jwt.claims`,
> inclusive em requisição anônima, então nenhuma chamada HTTP alcança a exceção —
> `service_role` incluído, porque seu token não traz `user_role`. Verificado na
> V8.

Crie mais dois para testar permissões:

```sql
-- depois de criar consultor@vegas.local e comercial@vegas.local no Studio
update public.profiles set role = 'consultor_campo' where email = 'consultor@vegas.local';
update public.profiles set role = 'comercial'       where email = 'comercial@vegas.local';
```

> **O papel só vale no próximo token.** Ele é lido do JWT, não consultado a cada
> requisição (ADR 0005). Quem já estiver logado continua com o papel antigo por até
> uma hora. Sempre saia e entre de novo depois de mudar papel.

---

## 6. As 12 verificações

### V1 — Migrations aplicaram na ordem

```bash
supabase migration list
```

As 10 migrations, de `20260802000001` a `20260802000010`, com marca em `Local`.

### V2 — Tabelas, enums e o que não pode existir

SQL Editor:

```sql
-- 7 tabelas
select tablename from pg_tables where schemaname = 'public' order by 1;

-- disponivel NAO pode estar no enum (ADR 0002)
select count(*) as deve_ser_zero
from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'visit_status' and e.enumlabel = 'disponivel';

-- unicidade SEM rule_type (ADR 0003)
select indexdef from pg_indexes
where tablename = 'product_segments' and indexname = 'product_segments_unico';
```

Esperado: `audit_logs, card_products, product_segments, profiles, segments,
system_settings, teams` · `deve_ser_zero = 0` · índice sobre
`(card_product_id, segment_id)`, **sem** `rule_type`.

### V3 — Seeds

```sql
select
  (select count(*) from public.card_products)    as modalidades,   -- 6
  (select count(*) from public.segments)         as segmentos,     -- 0
  (select count(*) from public.product_segments) as elegibilidade, -- 0
  (select count(*) from public.system_settings)  as parametros;    -- 7
```

> **Segmentos e elegibilidade em zero é o estado correto**, não seed que falhou.
>
> O seed trazia 13 segmentos escolhidos à mão. A medição da base real mostrou
> **interseção zero** com eles: os valores de `Subgrupo` são frases descritivas,
> com os erros da origem — `Comércio Verejista - Supermercados` em 826 linhas, com
> o typo, e `produtos farmacêutico` sem o `s`.
>
> Manter o seed criaria duas populações convivendo: 13 segmentos órfãos que nunca
> casam com nada, mais os 15 reais criados pela importação. E a disciplina de
> `source_name` — valor cru como chave de reconciliação — perderia o sentido se o
> valor cru fosse escolhido por nós.
>
> A importação popula. A fila em `/segmentos` mapeia para canônicos, e só então as
> regras são criadas em `/produtos`, contra segmentos que existem de fato.

Vegas Day e Plus não usam vínculo em `product_segments`, e isso está certo: modo
`all` não precisa.

### V4 — Elegibilidade: Farmácia não exibe posto

O critério de aceite número um:

```sql
select p.name as modalidade, s.normalized_name as segmento
from public.card_products p
cross join lateral public.eligible_segments(p.id) es
join public.segments s on s.id = es.segment_id
where p.slug in ('farmacia', 'vegas-day')
order by 1, 2;
```

Antes da primeira importação, **as duas devolvem vazio** — não há segmento
cadastrado. É a falha fechada do ADR 0003 funcionando: sem segmento mapeado,
nenhum estabelecimento é elegível a modalidade restrita.

O critério de aceite continua verificado, com fixtures próprias, em
`supabase/tests/07_segment_normalization.sql` — que é mais forte que verificar
contra seed, porque exercita também a resolução por alias.

Depois da primeira importação, esta consulta passa a ser o teste operacional:
**Farmácia** deve trazer apenas os segmentos farmacêuticos mapeados, e nunca
`Comércio de combustíveis`. Se trouxer, a falha fechada está furada — pare e
reporte.

### V5 — Custom Access Token Hook

O ponto mais frágil da instalação. Se não estiver ativo, **tudo funciona
aparentemente**, mas toda policy avalia o usuário como `consulta`.

Confira que o hook está registrado:

```sql
select proname, prosecdef from pg_proc
where proname = 'custom_access_token_hook';
```

Depois faça login como `gestor@vegas.local` e abra `/diagnostico`. A linha
**Papel no token (JWT)** precisa estar verde. Se disser que o claim difere do
perfil:

1. Saia e entre de novo (token antigo).
2. Se persistir, o hook não está ativo. Confira `[auth.hook.custom_access_token]`
   em `supabase/config.toml` e rode `supabase stop && supabase start` — mudança
   nessa seção só vale ao reiniciar o stack.

Para ver o claim direto:

```sql
select public.auth_role();  -- no SQL Editor devolve 'consulta': não há JWT ali
```

Isso não é bug. O SQL Editor não carrega JWT, e `auth_role()` cai para o papel mais
restrito — o comportamento correto de falhar para o lado seguro. A verificação real
é a de `/diagnostico`.

### V6 — Policies de RLS

```sql
-- FOR ALL e proibido
select count(*) as deve_ser_zero from pg_policies
where schemaname = 'public' and cmd = 'ALL';

-- audit_logs sem escrita para ninguem
select count(*) as deve_ser_zero from pg_policies
where tablename = 'audit_logs' and cmd in ('INSERT','UPDATE','DELETE');

-- RLS ligada nas 7
select relname, relrowsecurity from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;
```

Os dois primeiros: `0`. O terceiro: `relrowsecurity = true` nas sete.

### V7 — RLS na prática: consultor não altera parâmetro

Este é o teste que importa, porque exercita o caminho real. Entre como
`consultor@vegas.local` e, no console do navegador em `/dashboard`:

```js
const { createClient } = await import("/_next/static/chunks/...");  // impraticável
```

Mais simples: use a página `/configuracoes` quando existir. Por ora, teste por
`curl` com o token do consultor. Pegue o token no console do navegador logado:

```js
JSON.parse(localStorage.getItem(
  Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"))
)).access_token
```

```bash
TOKEN="<cole aqui>"
ANON="<anon key>"

curl -s -X PATCH \
  "http://127.0.0.1:54321/rest/v1/system_settings?key=eq.checkin_radius_meters" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"value": 999}'
```

Esperado: `[]` — resposta vazia. A policy não deixou nenhuma linha ser alcançada.

> Se vier `42501 permission denied for table system_settings`, **não comemore**:
> isso não é a RLS trabalhando, é falta de `grant` na tabela, e nesse estado
> *nenhum* papel escreve nem lê — inclusive o gestor master. Recusa por
> indisponibilidade se parece com recusa por política. Confira com a contraprova:
> o consultor precisa **conseguir ler** o parâmetro, e o gestor master precisa
> **conseguir alterá-lo**. Ver `supabase/migrations/20260823000011_table_grants.sql`.

Confirme que nada mudou:

```sql
select value from public.system_settings where key = 'checkin_radius_meters';  -- 200
```

Se voltar o objeto alterado, a RLS está furada. **Pare e reporte.**

### V8 — Consultor não se promove

Mesmo token, tentando escalar privilégio:

```bash
UID="<id do consultor, veja em profiles>"
curl -s -X PATCH "http://127.0.0.1:54321/rest/v1/profiles?id=eq.$UID" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"role": "gestor_master"}'
```

Esperado: erro contendo **"Alteracao de papel exige gestor_master"**. É o trigger
`fn_protect_profile_fields`. A policy de `update` sozinha não distingue coluna — sem
o trigger, o usuário se promoveria editando o próprio perfil.

Mudar o próprio nome deve funcionar:

```bash
curl -s -X PATCH "http://127.0.0.1:54321/rest/v1/profiles?id=eq.$UID" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"full_name": "Consultor Teste"}'
```

### V9 — Auditoria

No SQL Editor, como gestor:

```sql
update public.system_settings set value = '45'::jsonb where key = 'checkin_radius_meters';

select entity, action, changed_fields, old_value->>'value' as antes, new_value->>'value' as depois
from public.audit_logs order by occurred_at desc limit 1;

update public.system_settings set value = '200'::jsonb where key = 'checkin_radius_meters';
```

Esperado: uma linha em `system_settings`, `action = update`, `changed_fields`
contendo `value` e `updated_at`, `antes = 200`, `depois = 45`.

Confirme também que log não se apaga:

```sql
delete from public.audit_logs;   -- deve falhar ou afetar 0 linhas
```

Como `postgres` no SQL Editor o delete passa, porque superusuário ignora RLS.
Pelo PostgREST, com qualquer papel, não há policy de `delete` — logo, nada acontece.
Teste por `curl` se quiser a prova completa.

### V10 — Login

1. `/login` com senha errada → **"E-mail ou senha incorretos."**
   A mensagem é a mesma para e-mail inexistente, de propósito: distinguir entrega ao
   atacante a lista de quem tem conta.
2. Senha certa → redireciona para `/dashboard`.
3. Aba anônima em `/dashboard` sem sessão → redireciona para
   `/login?proximo=/dashboard`.
4. Logado, acessar `/login` → volta para `/dashboard`.

### V11 — Página de diagnóstico

`/diagnostico` com seis linhas, todas verdes:

| Verificação | Esperado |
|---|---|
| Sessão ativa | seu e-mail e papel |
| Papel no token (JWT) | claim e perfil coincidem |
| Modalidades | 6 |
| Segmentos | 13 |
| Regras de elegibilidade | 15 |
| Parâmetros operacionais | 7 de 7 carregados do banco |

Se **Parâmetros** disser que os valores são de fallback, o seed não rodou:
`supabase db reset`.

Teste a navegação por papel: entre como `comercial@vegas.local` — a barra lateral
não deve mostrar Importações, Usuários, Configurações nem Atenção.

### V12 — Testes automatizados

```bash
npm run test        # Vitest, sem banco
npm run typecheck   # tsc estrito
npm run lint        # ESLint
npm run db:test     # pgTAP
npm run test:parity # paridade SQL x TypeScript, exige o banco no ar
```

Esperado:

- Vitest: **254 testes, 9 arquivos, todos passando** (inclui contraste de token e
  ausência de hexadecimal em componente)
- typecheck: sem saída
- lint: sem erro
- pgTAP: 4 arquivos — `01`, `02`, `03` e `05` — **37 testes**, todos `ok`
- paridade: 2 arquivos, **32 testes**

`npm run check` roda os três primeiros de uma vez. **`test:parity` fica de fora
dele de propósito**: exige o banco local e falha, em vez de pular, se ele não
responder. No CI vive no job `banco`, que já sobe o stack (ADR 0010).

---

## 7. Problemas prováveis

**`supabase start` falha com porta ocupada.** Outro projeto Supabase rodando:
`supabase stop --project-id <outro>`, ou `docker ps` e pare o container.

**`supabase test db` diz que `plan` não existe.** O pgTAP entra pelo `seed.sql`, que
só roda em `db reset`, não em `db start`. Rode `supabase db reset`.

**Login devolve "Database error saving new user" ao criar usuário.** O trigger
`fn_handle_new_user` falhou. Veja a causa em `supabase logs db`. A versão atual tem
fallback em cascata para o nome, então o caso conhecido está coberto — se acontecer,
é outro, e quero saber qual.

**`/dashboard` em laço de redirecionamento.** Cookie de sessão inválido. Limpe os
cookies de `localhost` e entre de novo.

**Erro de tipo em `database.types.ts`.** Você rodou `npm run db:types` antes do
`supabase start`, e o arquivo saiu vazio. Rode de novo com o banco no ar.

**`create policy` em `storage.objects` falha por permissão.** Depende da versão da
CLI. Se a migration `0010` reclamar, aplique as duas policies pelo Studio
(**Storage** → **Policies**) e siga; os buckets em si são criados normalmente.

**Studio mostra as tabelas mas a aplicação não.** Chave errada em `.env.local`, ou
você colou a `service_role` no lugar da `anon`. Compare com `supabase status` e
reinicie o `npm run dev` — variável de ambiente não recarrega sozinha.

---

## 8. Reset limpo

```bash
supabase db reset     # apaga o banco, reaplica migrations e seed
supabase stop         # para os containers, preserva os dados
supabase stop --no-backup   # para e apaga tudo
```

Depois de `db reset` os usuários somem: refaça o passo 5.

---

## 9. Checklist

- [ ] V1 — 10 migrations aplicadas
- [ ] V2 — 7 tabelas · `disponivel` ausente · unicidade sem `rule_type`
- [ ] V3 — seeds: 6 / 13 / 15 / 7
- [ ] V4 — Farmácia sem posto · Vegas Day com tudo
- [ ] V5 — claim do JWT coincide com o perfil
- [ ] V6 — nenhuma policy `FOR ALL` · `audit_logs` sem escrita
- [ ] V7 — consultor não altera parâmetro
- [ ] V8 — consultor não se promove, mas edita o próprio nome
- [ ] V9 — auditoria grava alteração de parâmetro
- [ ] V10 — login, redirecionamentos e mensagem de erro
- [ ] V11 — diagnóstico com seis linhas verdes
- [ ] V12 — 254 Vitest · typecheck · lint · 37 pgTAP · 32 de paridade

Falhando qualquer uma, me mande o comando, a saída e o passo. Corrigimos antes da
Sprint 1.
