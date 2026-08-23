-- 0007 Parametros operacionais
-- Nenhum numero fixo em componente (CLAUDE.md secao 9).

create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  value_type  text not null check (value_type in ('integer', 'decimal', 'boolean', 'string')),
  unit        text,
  min_value   numeric,
  max_value   numeric,
  description text not null,
  min_role    public.user_role not null default 'gestor_master',
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);

comment on column public.system_settings.min_role is
  'Papel minimo para alterar a chave. Faixas de recencia sao estruturais (gestor_master);
   parametros de operacao diaria ficam com administrativo.';

alter table public.system_settings enable row level security;

create trigger system_settings_touch before update on public.system_settings
  for each row execute function public.fn_touch_updated_at();

create trigger system_settings_audit after insert or update or delete on public.system_settings
  for each row execute function public.fn_audit();

-- Valor numerico dentro da faixa declarada. Evita 0 dias ou raio negativo.
create or replace function public.fn_validate_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_num numeric;
begin
  if new.value_type in ('integer', 'decimal') then
    begin
      v_num := (new.value #>> '{}')::numeric;
    exception when others then
      raise exception 'Parametro %: valor % nao e numerico', new.key, new.value;
    end;

    if new.value_type = 'integer' and v_num <> trunc(v_num) then
      raise exception 'Parametro %: esperado inteiro, recebido %', new.key, v_num;
    end if;
    if new.min_value is not null and v_num < new.min_value then
      raise exception 'Parametro %: % abaixo do minimo %', new.key, v_num, new.min_value;
    end if;
    if new.max_value is not null and v_num > new.max_value then
      raise exception 'Parametro %: % acima do maximo %', new.key, v_num, new.max_value;
    end if;
  end if;
  return new;
end;
$$;

create trigger system_settings_validate before insert or update on public.system_settings
  for each row execute function public.fn_validate_setting();

-- Coerencia entre as tres faixas de recencia. Se recente > atencao, a classificacao
-- inteira vira nonsense silencioso, entao a checagem e no banco.
create or replace function public.fn_check_recency_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r numeric; a numeric; c numeric;
begin
  if new.key not in ('transaction_recent_days','transaction_attention_days','transaction_action_days') then
    return new;
  end if;

  select (value #>> '{}')::numeric into r from public.system_settings where key = 'transaction_recent_days';
  select (value #>> '{}')::numeric into a from public.system_settings where key = 'transaction_attention_days';
  select (value #>> '{}')::numeric into c from public.system_settings where key = 'transaction_action_days';

  if new.key = 'transaction_recent_days'    then r := (new.value #>> '{}')::numeric; end if;
  if new.key = 'transaction_attention_days' then a := (new.value #>> '{}')::numeric; end if;
  if new.key = 'transaction_action_days'    then c := (new.value #>> '{}')::numeric; end if;

  if r is not null and a is not null and c is not null and not (r < a and a < c) then
    raise exception 'Faixas de recencia fora de ordem: recente=%, atencao=%, acao=%', r, a, c;
  end if;
  return new;
end;
$$;

create trigger system_settings_recency after insert or update on public.system_settings
  for each row execute function public.fn_check_recency_order();

-- ---------------------------------------------------------------------------
-- Classificacao transacional em SQL: fonte de verdade para filtro e mapa (T1).
-- STABLE, nao IMMUTABLE, porque le system_settings. Consequencia: NAO pode ser
-- usada em indice. O indice vai em last_transaction_at; o filtro compara datas.
-- Se o limite mudar, um indice materializado passaria a mentir.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_transaction_status(
  p_last_transaction_at timestamptz,
  p_recent_days integer default null,
  p_attention_days integer default null,
  p_action_days integer default null
)
returns public.transaction_status
language plpgsql
stable
set search_path = ''
as $$
declare
  v_recent integer := p_recent_days;
  v_attention integer := p_attention_days;
  v_action integer := p_action_days;
  v_days integer;
begin
  if p_last_transaction_at is null then
    return 'nunca_transacionou';
  end if;

  if v_recent is null or v_attention is null or v_action is null then
    select
      max(case when key = 'transaction_recent_days'    then (value #>> '{}')::int end),
      max(case when key = 'transaction_attention_days' then (value #>> '{}')::int end),
      max(case when key = 'transaction_action_days'    then (value #>> '{}')::int end)
    into v_recent, v_attention, v_action
    from public.system_settings;
  end if;

  -- Data civil em America/Sao_Paulo: uma transacao das 22h de ontem nao pode virar
  -- "hoje" ou "anteontem" conforme o fuso do servidor.
  v_days := (
    (now() at time zone 'America/Sao_Paulo')::date
    - (p_last_transaction_at at time zone 'America/Sao_Paulo')::date
  );

  if v_days < 0 then
    return 'recente';  -- data futura na base: trata como recente, importacao sinaliza
  elsif v_days <= v_recent then
    return 'recente';
  elsif v_days <= v_attention then
    return 'atencao';
  elsif v_days <= v_action then
    return 'acao_necessaria';
  else
    return 'critico';
  end if;
end;
$$;

comment on function public.calculate_transaction_status is
  'Fonte de verdade da classificacao por recencia. STABLE porque le system_settings,
   portanto nao indexavel. Gemea em TypeScript coberta por teste de paridade.';

grant execute on function public.calculate_transaction_status(timestamptz, integer, integer, integer)
  to authenticated;
