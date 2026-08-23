-- 0004 Equipes e perfis
-- profiles.team_id e teams.supervisor_id formam ciclo. As duas tabelas sao criadas
-- primeiro e as FKs entram depois; a de teams e deferrable para o seed conseguir
-- inserir equipe e supervisor na mesma transacao.

create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  supervisor_id uuid,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) >= 3),
  email      extensions.citext not null unique,
  role       public.user_role not null default 'consulta',
  team_id    uuid,
  phone      text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'Padrao consulta: papel novo entra no mais restrito. Promocao e ato explicito e auditado.';
comment on column public.profiles.phone is
  'Somente digitos, DDD + numero. A formatacao e responsabilidade da interface.';

alter table public.profiles
  add constraint profiles_team_fk foreign key (team_id) references public.teams (id) on delete set null;

alter table public.teams
  add constraint teams_supervisor_fk foreign key (supervisor_id) references public.profiles (id)
  on delete set null deferrable initially deferred;

create index profiles_team_idx on public.profiles (team_id);
create index profiles_role_idx on public.profiles (role) where is_active;
create index teams_supervisor_idx on public.teams (supervisor_id);

create trigger teams_touch    before update on public.teams    for each row execute function public.fn_touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.fn_touch_updated_at();

alter table public.teams    enable row level security;
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Perfil criado junto com o usuario do Auth.
-- ---------------------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  -- Fallback em cascata. O check exige 3 caracteres; se o local-part do e-mail for
  -- menor (ti@vegas.com), usar o e-mail inteiro. Falhar aqui derrubaria a criacao
  -- do usuario no Auth com uma mensagem que nao aponta a causa.
  if length(v_name) < 3 then
    v_name := split_part(new.email, '@', 1);
  end if;
  if length(v_name) < 3 then
    v_name := new.email;
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    v_name,
    new.email,
    'consulta'   -- nunca aceitar papel vindo do metadata: o usuario controla esse campo
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.fn_handle_new_user is
  'Cria profiles no signup. O papel e sempre consulta: raw_user_meta_data e escrito pelo
   proprio usuario no cadastro, entao aceitar role dali seria escalacao de privilegio.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

revoke execute on function public.fn_handle_new_user() from public;
