-- 0006 Custom Access Token Hook
-- Injeta user_role no JWT no momento da emissao. Ponto unico de falha na emissao de
-- token: se levantar excecao, ninguem loga. Por isso o tratamento defensivo.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_role public.user_role;
  v_active boolean;
begin
  select role, is_active into v_role, v_active
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  -- Usuario desativado nao perde o token, mas perde o papel: cai para consulta.
  if v_role is null or v_active is not true then
    v_role := 'consulta';
  end if;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_role::text));

  return jsonb_set(event, '{claims}', v_claims);
exception when others then
  -- Falhar aqui derrubaria o login de todo mundo. Degrada para consulta e segue.
  raise warning 'custom_access_token_hook: %', sqlerrm;
  return jsonb_set(
    event,
    '{claims}',
    jsonb_set(coalesce(event -> 'claims', '{}'::jsonb), '{user_role}', '"consulta"'::jsonb)
  );
end;
$$;

comment on function public.custom_access_token_hook is
  'Escreve user_role no JWT. Em qualquer falha degrada para consulta em vez de quebrar a
   emissao do token. Habilitar em config.toml: auth.hook.custom_access_token.';

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- O hook roda como supabase_auth_admin e precisa ler profiles com a RLS ativa.
grant usage on schema public to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;

create policy "auth admin le profiles para o hook"
  on public.profiles for select to supabase_auth_admin using (true);
