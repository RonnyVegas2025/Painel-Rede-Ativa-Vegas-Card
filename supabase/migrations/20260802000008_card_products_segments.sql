-- 0008 Catalogo: modalidades, segmentos e elegibilidade (ADR 0003)

create table public.card_products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  eligibility_mode public.eligibility_mode not null default 'allowlist',
  description      text,
  display_order    smallint not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.segments (
  id              uuid primary key default gen_random_uuid(),
  source_name     text not null unique,
  normalized_name text not null,
  category        text not null default 'outros'
                  check (category in ('alimentacao','combustivel','farmacia','refeicao','servicos','outros')),
  cnae_hint       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.segments.source_name is
  'Valor cru da coluna Subgrupo da planilha. E a chave de reconciliacao na proxima
   importacao, entao nao normalizar nem corrigir aqui.';

create table public.product_segments (
  id              uuid primary key default gen_random_uuid(),
  card_product_id uuid not null references public.card_products (id) on delete cascade,
  segment_id      uuid not null references public.segments (id) on delete cascade,
  rule_type       public.segment_rule_type not null,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),

  -- rule_type FORA da chave, de proposito. Com ele dentro, allow e deny para o mesmo
  -- par seriam duas linhas legais e a contradicao viraria problema da aplicacao.
  -- Assim o banco recusa. Ver ADR 0003.
  constraint product_segments_unico unique (card_product_id, segment_id)
);

create index product_segments_produto_idx on public.product_segments (card_product_id, rule_type);
create index product_segments_segmento_idx on public.product_segments (segment_id);
create index segments_categoria_idx on public.segments (category) where is_active;

create trigger card_products_touch before update on public.card_products
  for each row execute function public.fn_touch_updated_at();
create trigger segments_touch before update on public.segments
  for each row execute function public.fn_touch_updated_at();

create trigger card_products_audit after insert or update or delete on public.card_products
  for each row execute function public.fn_audit();
create trigger segments_audit after insert or update or delete on public.segments
  for each row execute function public.fn_audit();
create trigger product_segments_audit after insert or update or delete on public.product_segments
  for each row execute function public.fn_audit();

alter table public.card_products    enable row level security;
alter table public.segments         enable row level security;
alter table public.product_segments enable row level security;

-- ---------------------------------------------------------------------------
-- Elegibilidade. Gemea SQL da funcao TypeScript, coberta por teste de paridade.
-- IMMUTABLE: depende so dos argumentos, entao pode ser usada em indice futuro.
-- ---------------------------------------------------------------------------
create or replace function public.is_segment_eligible(
  p_mode public.eligibility_mode,
  p_rule public.segment_rule_type
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_mode
    when 'all'       then true
    when 'allowlist' then p_rule = 'allow'          -- nulo => falso: falha fechada
    when 'denylist'  then p_rule is distinct from 'deny'
  end;
$$;

comment on function public.is_segment_eligible is
  'Em allowlist, segmento sem regra e inelegivel (p_rule nulo => false). Falha fechada:
   segmento nao mapeado nunca aparece em modalidade restrita. Ver ADR 0003.';

-- Segmentos elegiveis de um produto, ja resolvendo o modo.
create or replace function public.eligible_segments(p_card_product_id uuid)
returns table (segment_id uuid)
language sql
stable
set search_path = ''
as $$
  select s.id
  from public.segments s
  cross join lateral (
    select cp.eligibility_mode from public.card_products cp where cp.id = p_card_product_id
  ) prod
  left join public.product_segments ps
    on ps.segment_id = s.id and ps.card_product_id = p_card_product_id
  where s.is_active
    and public.is_segment_eligible(prod.eligibility_mode, ps.rule_type);
$$;

grant execute on function public.is_segment_eligible(public.eligibility_mode, public.segment_rule_type) to authenticated;
grant execute on function public.eligible_segments(uuid) to authenticated;
