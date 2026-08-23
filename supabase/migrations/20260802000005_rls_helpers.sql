-- 0005 Funcoes auxiliares de RLS
-- O papel vem do claim do JWT, nunca de consulta a profiles (ADR 0005).
-- Consultar profiles dentro da policy de profiles e recursao infinita.

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''),
    'consulta'
  )::public.user_role;
$$;

comment on function public.auth_role is
  'Papel do usuario a partir do claim do JWT. Nunca devolve nulo: ausencia de claim cai
   para consulta, o papel mais restrito. Falhar para o lado seguro.';

create or replace function public.has_role(variadic p_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.auth_role() = any(p_roles);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.auth_role() in ('gestor_master', 'administrativo');
$$;

-- Equipe do usuario. Esta consulta profiles, mas nunca e usada em policy DE profiles,
-- entao nao ha recursao. SECURITY DEFINER para nao depender da RLS de profiles.
create or replace function public.auth_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select team_id from public.profiles where id = (select auth.uid());
$$;

comment on function public.auth_team_id is
  'Equipe do usuario atual. Nao usar em policy de profiles: causaria recursao.';

revoke execute on function public.auth_role()    from public;
revoke execute on function public.has_role(public.user_role[]) from public;
revoke execute on function public.is_admin()     from public;
revoke execute on function public.auth_team_id() from public;

grant execute on function public.auth_role()    to authenticated;
grant execute on function public.has_role(public.user_role[]) to authenticated;
grant execute on function public.is_admin()     to authenticated;
grant execute on function public.auth_team_id() to authenticated;
