-- 0003 Nucleo de auditoria
-- Vem antes das tabelas porque os triggers das proximas migrations dependem da funcao.

create table public.audit_logs (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_id       uuid,                       -- nulo quando a origem e sistema
  actor_role     public.user_role,           -- copia, nao juncao: ver comentario abaixo
  action         public.audit_action not null,
  entity         text not null,
  entity_id      text,
  old_value      jsonb,
  new_value      jsonb,
  changed_fields text[],
  origin         public.audit_origin not null default 'web',
  ip_address     inet,                       -- nulo quando nao obtido de forma confiavel
  user_agent     text,
  reason         text
);

comment on column public.audit_logs.actor_role is
  'Papel no momento do ato, gravado por copia. O papel do usuario muda com o tempo e o log
   precisa registrar sob qual autoridade o ato foi praticado, nao qual e a autoridade hoje.';
comment on column public.audit_logs.ip_address is
  'Nulo quando indisponivel. inet_client_addr() no Supabase devolve o IP do pooler, igual
   para todos, o que daria falsa sensacao de rastreabilidade. Ver ADR/T3.';

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);

alter table public.audit_logs enable row level security;
-- Sem policy nenhuma neste momento = ninguem le. As policies de leitura entram na 0009.
-- Nunca havera policy de update nem de delete: log editavel nao e log.

-- ---------------------------------------------------------------------------
-- IP real da requisicao, quando obtivel.
-- ---------------------------------------------------------------------------
create or replace function public.request_ip()
returns inet
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_raw text;
begin
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  -- x-forwarded-for pode vir como lista: o cliente e o primeiro item.
  v_raw := split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1);
  v_raw := trim(v_raw);

  if v_raw = '' then
    return null;
  end if;

  begin
    return v_raw::inet;   -- cabecalho e dado do cliente: pode vir qualquer coisa
  exception when others then
    return null;
  end;
end;
$$;

comment on function public.request_ip is
  'IP do cliente a partir do cabecalho da requisicao. Devolve nulo quando indisponivel ou
   malformado, em vez de gravar um endereco errado.';

-- ---------------------------------------------------------------------------
-- Trigger generico de auditoria.
-- Uso: create trigger ... execute function public.fn_audit();
-- ---------------------------------------------------------------------------
create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_entity_id text;
  v_actor uuid := auth.uid();
  v_role public.user_role;
begin
  begin
    v_role := nullif(
      current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''
    )::public.user_role;
  exception when others then
    v_role := null;
  end;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_entity_id := v_old ->> 'id';
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_entity_id := v_new ->> 'id';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_entity_id := v_new ->> 'id';
    select array_agg(key order by key) into v_changed
    from jsonb_each(v_new)
    where v_old -> key is distinct from v_new -> key;

    -- Update que nao mudou nada nao vira linha de log: ruido puro.
    if v_changed is null then
      return new;
    end if;
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity, entity_id,
    old_value, new_value, changed_fields, origin, ip_address, user_agent
  ) values (
    v_actor, v_role, lower(tg_op)::public.audit_action, tg_table_name, v_entity_id,
    v_old, v_new, v_changed,
    case when v_actor is null then 'system' else 'web' end::public.audit_origin,
    public.request_ip(),
    nullif(current_setting('request.headers', true)::jsonb ->> 'user-agent', '')
  );

  return coalesce(new, old);
exception when others then
  -- Falha de auditoria nao pode derrubar a operacao de negocio, mas tambem nao pode
  -- passar despercebida. Vai para o log do Postgres.
  raise warning 'fn_audit falhou em %: %', tg_table_name, sqlerrm;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.fn_audit() from public;
revoke execute on function public.request_ip() from public;
grant execute on function public.request_ip() to authenticated;

comment on function public.fn_audit is
  'Trigger generico de auditoria. SECURITY DEFINER porque grava em audit_logs, onde
   nenhum papel tem insert direto.';

-- Utilitario de updated_at, usado por praticamente toda tabela.
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
