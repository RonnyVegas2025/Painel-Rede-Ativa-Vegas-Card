-- 0018 Estabelecimentos, enderecos, pontos de captura e importacao
--
-- A unidade operacional do sistema entra no banco. Seis tabelas.
--
-- NENHUMA E SEMEADA. Em especial capture_methods: o complemento de analise lista
-- Stone, Cielo, Rede, Getnet, PagBank, Adiq e Softnex, e semear com esses nomes
-- seria o mesmo defeito de reconciliacao que `source_name` existe para evitar em
-- segments. Se a planilha grafar "STONE PAGAMENTOS" na coluna Captacao, o seed
-- manual cria um registro e o importador cria outro. A tabela nasce vazia; o
-- importador a preenche a partir dos valores reais, com source_name guardando o
-- valor cru.
--
-- establishment_transactions NAO e criada aqui, e a ausencia e deliberada — ver o
-- comentario ao final do arquivo.

begin;

-- ===========================================================================
-- capture_methods — meio de captura. Minima agora; a Sprint 6 enriquece.
-- ===========================================================================
-- Entra na Sprint 1, e nao na 6 como previa o roadmap, porque
-- establishment_capture_points referencia esta tabela e o dado de Captacao chega
-- no momento da importacao. FK nascendo nula para preencher depois obrigaria a
-- Sprint 6 a re-derivar o vinculo a partir das linhas cruas de import_rows, com a
-- base ja em uso.
create table public.capture_methods (
  id            uuid primary key default gen_random_uuid(),
  source_name   text not null unique,   -- valor cru da coluna Captacao
  name          text not null,          -- rotulo humano
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.capture_methods is
  'Meio de captura. Nasce vazia: populada pelo importador a partir dos valores
   distintos de Captacao. source_name guarda o valor cru e e a chave de
   reconciliacao na proxima importacao, mesma disciplina de segments.';

-- ===========================================================================
-- establishments — o ponto credenciado (ADR 0001)
-- ===========================================================================
create table public.establishments (
  id                       uuid primary key default gen_random_uuid(),

  -- Identidade prioritaria. Unico quando presente; ausencia e comum e legitima,
  -- e o fallback do ADR 0001 cobre. Colisao dentro do mesmo arquivo vai para
  -- import_rows como conflito, nunca decide sozinha.
  external_contract        text,

  -- Atributo indexado, NUNCA chave unica: o mesmo CNPJ tem varias lojas, e
  -- colapsa-las impediria o consultor de visitar a segunda (ADR 0001).
  cnpj                     text,

  legal_name               text not null,
  trade_name               text not null,
  segment_id               uuid references public.segments(id),

  -- Cinco dimensoes independentes, nunca um campo generico `status`.
  registration_status      public.registration_status not null default 'ativo',
  operational_status       public.operational_status  not null default 'apto',

  -- Desde quando ha relacionamento (coluna Data de Cadastro), que nao e o mesmo
  -- que created_at, quando o registro entrou neste sistema.
  relationship_start_date  date,

  last_transaction_at      timestamptz,
  -- Redundante com `last_transaction_at is null` de proposito: nulo pode
  -- significar "nunca transacionou" ou "nao informado", e a planilha distingue os
  -- dois com o texto `Nunca Transacionou`. Redundancia sem constraint diverge.
  never_transacted         boolean not null default false,

  phone                    text,
  email                    text,
  origin                   text,
  description              text,

  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint establishments_cnpj_digitos
    check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  constraint establishments_nunca_transacionou_coerente
    check (not never_transacted or last_transaction_at is null)
);

comment on column public.establishments.cnpj is
  'Atributo indexado, nunca chave unica (ADR 0001): o mesmo CNPJ tem varias lojas.';
comment on column public.establishments.never_transacted is
  'Verdadeiro apenas quando a planilha trouxe o texto Nunca Transacionou. Nulo em
   last_transaction_at sem esta flag significa dado nao informado.';
comment on column public.establishments.relationship_start_date is
  'Desde quando existe relacionamento. Nao confundir com created_at.';

-- Identidade prioritaria: unica quando presente.
create unique index establishments_contrato_unico
  on public.establishments (external_contract)
  where external_contract is not null;

-- Fallback do ADR 0001: CNPJ mais endereco normalizado. Sem este indice, a
-- importacao faz 1.804 varreduras completas — uma por linha.
create index establishments_cnpj
  on public.establishments (cnpj)
  where cnpj is not null;

-- ===========================================================================
-- establishment_addresses — historico. `mudanca_endereco` preserva o anterior.
-- ===========================================================================
create table public.establishment_addresses (
  id                 uuid primary key default gen_random_uuid(),
  establishment_id   uuid not null references public.establishments(id) on delete cascade,

  -- Endereco original importado, preservado sempre, intocado (ADR 0006).
  street             text not null,
  cep                text,
  city               text not null,
  state              text not null,

  -- GERADA PELO BANCO, nao gravada pela aplicacao.
  --
  -- O ADR 0001 exige que a normalizacao seja persistida, porque e chave de
  -- identidade. Persistir e deixar a aplicacao gravar sao coisas diferentes: um
  -- defeito no importador escreveria hash divergente, e hash divergente so se
  -- corrige com migracao de dados.
  --
  -- Como coluna gerada, quem calcula e public.normalize_address — a mesma funcao
  -- que o arnes de paridade compara com a gemea TypeScript a cada CI. A gemea
  -- continua existindo para o importador casar linha ANTES de gravar; o valor
  -- gravado nao depende dela.
  normalized_address text generated always as (public.normalize_address(street, cep)) stored,
  address_hash       text generated always as (md5(public.normalize_address(street, cep))) stored,

  latitude           double precision,
  longitude          double precision,

  is_current         boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint establishment_addresses_cep_digitos
    check (cep is null or cep ~ '^[0-9]{8}$')
);

comment on column public.establishment_addresses.normalized_address is
  'Gerada pelo banco por public.normalize_address. A aplicacao nao grava: um
   defeito no importador produziria hash divergente, e hash divergente exige
   migracao de dados para corrigir.';

-- UM endereco corrente por estabelecimento. Sem isto, "mudou de endereco" pode
-- deixar dois correntes e o check-in por raio da Sprint 3 passa a usar coordenada
-- arbitraria — bug que aparece longe da causa.
create unique index establishment_addresses_um_corrente
  on public.establishment_addresses (establishment_id)
  where is_current;

-- Segunda metade do fallback do ADR 0001. Parcial sobre o corrente: casar contra
-- endereco antigo reviveria identidade que mudou de lugar.
create index establishment_addresses_hash_corrente
  on public.establishment_addresses (address_hash)
  where is_current;

-- ===========================================================================
-- establishment_capture_points — `Terminal` deixou de ser coluna
-- ===========================================================================
create table public.establishment_capture_points (
  id                 uuid primary key default gen_random_uuid(),
  establishment_id   uuid not null references public.establishments(id) on delete cascade,
  -- Nula ate o importador reconciliar o valor de Captacao com capture_methods.
  capture_method_id  uuid references public.capture_methods(id),
  terminal_number    text not null,
  status             public.capture_point_status not null default 'ativo',
  is_primary         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- UM primario por estabelecimento (complemento de analise §5, padrao do ADR 0002).
create unique index establishment_capture_points_um_primario
  on public.establishment_capture_points (establishment_id)
  where is_primary;

create index establishment_capture_points_estabelecimento
  on public.establishment_capture_points (establishment_id);

-- A unicidade de terminal NAO entra aqui: vive na 0020, sozinha, porque a chave
-- correta depende de medicao no arquivo real e trocar uma migration que so cria
-- indice e mais barato que editar uma que tambem cria tabela.

-- ===========================================================================
-- import_jobs — a importacao e sincronizacao, nao cadastro
-- ===========================================================================
create table public.import_jobs (
  id                     uuid primary key default gen_random_uuid(),
  file_name              text not null,
  storage_path           text not null,
  uploaded_by            uuid references public.profiles(id),

  -- Escopo declarado. Nulo significa "toda a base". O estado `ausente` so e
  -- calculado DENTRO do escopo: sem isso, importar um recorte de uma cidade faria
  -- o resto da base inteira aparecer como sumido.
  scope_city             text,
  scope_card_product_id  uuid references public.card_products(id),

  started_at             timestamptz not null default now(),
  finished_at            timestamptz,

  total_rows             integer not null default 0,
  created_count          integer not null default 0,
  updated_count          integer not null default 0,
  unchanged_count        integer not null default 0,
  error_count            integer not null default 0,
  conflict_count         integer not null default 0,
  -- Presentes na base e ausentes no arquivo. NUNCA excluidos.
  missing_count          integer not null default 0,

  -- Trava do limiar de ausentes. O desastre classico e exportar a planilha com um
  -- filtro aplicado e a base inteira aparecer como sumida. Nada seria excluido,
  -- mas uma fila administrativa com 1.400 itens e indistinguivel de ruido, e o
  -- efeito pratico e o mesmo. O limiar vive em system_settings, nao aqui.
  requires_confirmation  boolean not null default false,
  confirmed_by           uuid references public.profiles(id),
  confirmed_at           timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint import_jobs_confirmacao_completa
    check ((confirmed_by is null) = (confirmed_at is null))
);

comment on column public.import_jobs.scope_city is
  'Escopo declarado da importacao. Nulo = toda a base. `ausente` so e calculado
   dentro do escopo.';
comment on column public.import_jobs.requires_confirmation is
  'Verdadeiro quando a contagem de ausentes passou do limiar parametrizado. O job
   para e exige confirmacao explicita, com o numero na tela.';

-- ===========================================================================
-- import_rows — a linha crua da planilha
-- ===========================================================================
create table public.import_rows (
  id                 uuid primary key default gen_random_uuid(),
  import_id          uuid not null references public.import_jobs(id) on delete cascade,
  line_number        integer not null,
  status             public.import_row_status not null,
  -- Dado de terceiro: telefone, e-mail e razao social. Leitura restrita.
  raw_data           jsonb not null,
  establishment_id   uuid references public.establishments(id),
  error_message      text,
  created_at         timestamptz not null default now(),

  constraint import_rows_linha_unica unique (import_id, line_number)
);

create index import_rows_por_status on public.import_rows (import_id, status);

comment on table public.import_rows is
  'Linha crua da planilha, com a classificacao. Guarda dado de terceiro — nao e
   leitura para todo autenticado.';

-- ===========================================================================
-- updated_at e auditoria
-- ===========================================================================
create trigger capture_methods_touch before update on public.capture_methods
  for each row execute function public.fn_touch_updated_at();
create trigger establishments_touch before update on public.establishments
  for each row execute function public.fn_touch_updated_at();
create trigger establishment_addresses_touch before update on public.establishment_addresses
  for each row execute function public.fn_touch_updated_at();
create trigger establishment_capture_points_touch before update on public.establishment_capture_points
  for each row execute function public.fn_touch_updated_at();
create trigger import_jobs_touch before update on public.import_jobs
  for each row execute function public.fn_touch_updated_at();

create trigger capture_methods_audit after insert or update or delete on public.capture_methods
  for each row execute function public.fn_audit();
create trigger establishments_audit after insert or update or delete on public.establishments
  for each row execute function public.fn_audit();
create trigger establishment_addresses_audit after insert or update or delete on public.establishment_addresses
  for each row execute function public.fn_audit();
create trigger establishment_capture_points_audit after insert or update or delete on public.establishment_capture_points
  for each row execute function public.fn_audit();

-- import_rows e import_jobs nao recebem trilha de auditoria: o proprio par ja e a
-- trilha da importacao, linha a linha, e duplicar encheria audit_logs com 1.804
-- entradas por execucao sem acrescentar informacao.

-- ===========================================================================
-- RLS ligada. As policies vivem na 0019.
-- ===========================================================================
alter table public.capture_methods                enable row level security;
alter table public.establishments                 enable row level security;
alter table public.establishment_addresses        enable row level security;
alter table public.establishment_capture_points   enable row level security;
alter table public.import_jobs                    enable row level security;
alter table public.import_rows                    enable row level security;

-- ===========================================================================
-- Ausencia deliberada: establishment_transactions
-- ===========================================================================
-- Nao existe, e nao e esquecimento.
--
-- Onde entra: Sprint 8, metricas transacionais, com ingestao e consolidacao
-- horaria e diaria. Por que ainda nao: a Sprint 8 esta bloqueada pela origem dos
-- dados transacionais. A planilha traz apenas uma data de ultima transacao, e nao
-- ha como derivar historico dela.
--
-- Para as Sprints 1 e 2, establishments.last_transaction_at basta: e tudo o que a
-- classificacao de recencia consome.
--
-- Criar a tabela vazia agora convidaria alguem a preenche-la com premissa errada
-- antes de a origem existir — e 1.804 estabelecimentos por 24 horas por 365 dias
-- sao cerca de 15,8 milhoes de linhas por ano, volume que exige decisao de
-- particionamento que nao se toma sem conhecer o formato da origem.

commit;
