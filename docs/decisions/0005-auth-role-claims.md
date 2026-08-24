# ADR 0005 — Papel no JWT

- **Status:** aceito
- **Data:** 2026-07-31

## Contexto
As policies precisam do papel do usuário. O caminho ingênuo é
`(select role from profiles where id = auth.uid())` dentro da policy. Em `profiles` isso é
recursão infinita: a policy consulta a tabela que a policy protege. Nas demais tabelas
funciona, mas adiciona uma subconsulta a cada avaliação de linha.

## Decisão
O papel vai como claim `user_role` no JWT, escrito pelo **Custom Access Token Hook** do
Supabase no momento da emissão do token.

Funções auxiliares em `lib/business-rules` do lado SQL:

```sql
create function public.auth_role() returns user_role
language sql stable
set search_path = ''
as $$ select coalesce(
  nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''),
  'consulta')::public.user_role $$;
```

Toda `SECURITY DEFINER`: `set search_path = ''`, `revoke execute from public`, `grant` só
para `authenticated`, argumentos validados, finalidade em comentário `COMMENT ON FUNCTION`.

Nas policies, `(select auth.uid())` em vez de `auth.uid()`. O planejador trata a subconsulta
como initPlan e avalia uma vez por consulta, não uma vez por linha. Numa listagem de 1.804
registros isso é diferença de ordem de grandeza.

Policies separadas por comando. `for all` é proibido — obriga a pensar em `delete`, que é
justamente onde o descuido custa caro.

## Alternativas consideradas
- **Consulta a `profiles` na policy.** Recursão em `profiles`, custo por linha nas demais.
- **`raw_app_meta_data` sem hook.** Funciona, mas depende de escrita direta em tabela do
  schema `auth` e é frágil entre versões.
- **Papel só na aplicação.** Descartada: permissão que só existe no front-end não é permissão.

## Consequências
- **Mudança de papel só vale no próximo token.** Com refresh de uma hora, o usuário pode
  operar até sessenta minutos com o papel antigo. Rebaixamento e desativação exigem revogar a
  sessão, não só editar a linha. Isso está em `permissions.md` e precisa estar na tela de
  usuários, senão o administrador acha que revogou e não revogou.
- O hook é ponto único de falha na emissão de token: erro ali derruba o login de todo mundo.
  Tem teste pgTAP próprio e tratamento defensivo com queda para `consulta`.
- `auth_role()` nunca devolve nulo. Ausência de claim é `consulta`, o papel mais restrito.
- **Promoção de papel exige o JWT de um gestor master. `service_role` não serve.**
  A trigger `fn_protect_profile_fields` decide por `auth_role()`, que lê a claim
  `user_role`. O token de `service_role` traz `role = service_role` e nenhum
  `user_role`, então `auth_role()` devolve `consulta` e a trigger recusa — verificado
  com o banco no ar durante a validação da Sprint 0.

  Isso está certo e é deliberado: `service_role` ignora RLS, e uma tela de
  administração que promovesse papel por ele daria a qualquer bug de rota o poder de
  criar gestor master.

  A consequência prática é para quem construir `usuarios.gerenciar`: **a alteração de
  papel tem que sair do cliente autenticado do gestor**, com o token dele, e não do
  `createAdminClient()`. Quem tentar pelo caminho do service role vai bater na trigger,
  e a tentação será afrouxá-la sem entender por que ela existe. Não afrouxar.

  A exceção da migration 0013 — conexão sem contexto HTTP — não ajuda aqui: ela cobre
  `psql` e SQL Editor, onde não há claim nenhuma. Toda requisição pela API traz claims,
  inclusive a de `service_role`, e portanto não a alcança.
