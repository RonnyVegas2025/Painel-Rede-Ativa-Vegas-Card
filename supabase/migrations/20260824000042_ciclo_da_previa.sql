-- 0042 Criar, finalizar e descartar previa
--
-- ===========================================================================
-- TODAS AS QUATRO SAO `security invoker`. E DE PROPOSITO.
-- ===========================================================================
-- A licao do furo do import_commit foi que `security definer` desliga a RLS por
-- dentro, e ai a unica fronteira vira o `grant execute`. Estas quatro funcoes so
-- tocam import_jobs e import_rows, que TEM policy — entao nao ha motivo para
-- desligar a RLS: ela decide, como decide para as RPCs de segmento.
--
-- Consequencia pratica: o inventario de 05_grants_and_rls.sql continua com uma
-- unica funcao que escreve no dominio, e a lista nao cresce. Cada `definer` novo
-- e uma superficie a justificar por escrito; nenhuma destas precisou.
--
-- Como a RLS recusa em silencio (UPDATE bloqueado afeta zero linhas, nao levanta),
-- cada funcao confere `not found` e diz o que aconteceu. Recusa silenciosa se
-- parece com "nao existe", e ja confundimos as duas coisas nesta sprint.

begin;

-- ===========================================================================
-- 1. A convencao de line_number, declarada antes de alguem depender dela
-- ===========================================================================
comment on column public.import_rows.line_number is
  'Numero da linha NA PLANILHA de origem: o cabecalho e a linha 1, e a primeira
   linha de dados e a 2. Nao e indice de laco. `import_finalize_preview` depende
   disto para detectar lote parcial sem confiar no total que o cliente informa.';

-- ===========================================================================
-- 2. A brecha da policy de INSERT: faltava dizer EM QUAL JOB
-- ===========================================================================
-- A policy anterior permitia que gestao inserisse em import_rows sem dizer em
-- qual job. Entre a revisao das contagens e o commit, outro usuario de gestao
-- podia inserir linhas naquele job — e o commit aplica o que esta em import_rows,
-- incluindo as injetadas.
--
-- A conferencia de total nao pega: ela roda na transicao `processando -> previa`,
-- e a insercao aconteceria depois.
--
-- Nao e escalada de privilegio: quem insere ali ja podia escrever em
-- establishments direto. E integridade da revisao — o operador aprova um numero e
-- recebe outro.
--
-- Fechado declarativamente: linha so entra em job AINDA EM MONTAGEM, e so por
-- quem o criou. Job em `previa` fica imutavel por construcao, que e o que
-- "evidencia" significa.
drop policy "gestao cria linhas da importacao" on public.import_rows;

create policy "gestao cria linhas da propria previa em montagem"
  on public.import_rows for insert
  to authenticated
  with check (
    public.is_admin()
    and exists (
      select 1 from public.import_jobs j
       where j.id = import_id
         and j.status = 'processando'
         and j.uploaded_by = (select auth.uid())
    )
  );

comment on policy "gestao cria linhas da propria previa em montagem" on public.import_rows is
  'Escopada ao job e ao autor. Sem o escopo, um segundo usuario de gestao poderia
   injetar linhas numa previa ja revisada, entre a conferencia e o commit — e o
   commit aplica o que esta em import_rows. Job que saiu de `processando` nao
   aceita mais linha nenhuma.';

-- ===========================================================================
-- 3. Criar: o job nasce ANTES da signed URL
-- ===========================================================================
-- Se o operador sobe o arquivo e abandona antes da previa, um objeto sem dono
-- fica no bucket. Com o job criado primeiro e o caminho derivado do id dele, o
-- orfao passa a ser rastreavel, e o descarte fecha os dois de uma vez.
create or replace function public.import_create_preview(
  p_file_name  text,
  p_scope_city text
)
returns public.import_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_id  uuid := gen_random_uuid();
  v_job public.import_jobs;
begin
  if coalesce(btrim(p_file_name), '') = '' then
    raise exception 'Nome do arquivo e obrigatorio.';
  end if;

  -- Escopo declarado pelo operador, nunca inferido do conteudo: inferir escopo do
  -- dado e exatamente o erro que a trava de ausentes existe para pegar.
  if coalesce(btrim(p_scope_city), '') = '' then
    raise exception 'Escopo (cidade) e obrigatorio: sem ele, ausente passa a ser calculado sobre a base inteira.';
  end if;

  insert into public.import_jobs (id, file_name, storage_path, uploaded_by, scope_city, status)
  values (
    v_id,
    btrim(p_file_name),
    -- Caminho derivado do id: deterministico, sem colisao, e um objeto solto no
    -- bucket sempre aponta de volta para um job.
    'importacoes/' || v_id::text || '.xlsx',
    (select auth.uid()),
    btrim(p_scope_city),
    'processando'
  )
  returning * into v_job;

  return v_job;
exception when insufficient_privilege then
  raise exception 'Criar importacao exige o papel de gestor master ou administrativo.'
    using errcode = '42501';
end;
$$;

-- ===========================================================================
-- 4. Finalizar: duas conferencias, e uma delas nao confia no cliente
-- ===========================================================================
-- `p_total_lido` e o que o parser AFIRMA ter lido. Comparar so com ele deixa
-- passar o caso em que o proprio parser contou errado por bug de laco: os dois
-- numeros batem e a conferencia aprova um lote incompleto.
--
-- A segunda conferencia e independente do que o cliente afirma, e usa o numero de
-- linha que ele ja grava: sem buraco, e comecando na primeira linha de dados.
-- Queda de rede no meio deixa buraco no fim, e isso aparece mesmo com o total
-- errado. As duas juntas cobrem casos diferentes.
create or replace function public.import_finalize_preview(
  p_import_id  uuid,
  p_total_lido integer,
  p_duplicados integer default 0,
  p_sem_numero integer default 0
)
returns public.import_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_job    public.import_jobs;
  v_n      integer;
  v_min    integer;
  v_max    integer;
  v_status public.import_job_status;
begin
  select status into v_status from public.import_jobs where id = p_import_id;
  if v_status is null then
    raise exception 'Importacao % nao encontrada, ou sem permissao de leitura.', p_import_id;
  end if;
  if v_status <> 'processando' then
    raise exception 'Importacao ja saiu da montagem (estado: %). Finalizar duas vezes nao e possivel.', v_status;
  end if;

  select count(*), min(line_number), max(line_number)
    into v_n, v_min, v_max
    from public.import_rows where import_id = p_import_id;

  -- (a) Bate com o que o parser afirma ter lido.
  if v_n <> p_total_lido then
    raise exception
      'Lote incompleto: % linhas gravadas para % lidas do arquivo. A previa nao e aplicavel.',
      v_n, p_total_lido;
  end if;

  -- (b) Independente do que o cliente afirma: sequencia sem buraco, a partir da
  -- primeira linha de dados (o cabecalho e a linha 1 da planilha).
  if v_n = 0 or v_min <> 2 or v_n <> v_max - 1 then
    raise exception
      'Sequencia de linhas inconsistente: % linhas, da % a %. Esperado de 2 a %, sem buraco.',
      v_n, v_min, v_max, v_n + 1;
  end if;

  update public.import_jobs set
    status                     = 'previa',
    total_rows                 = v_n,
    duplicated_capture_methods = greatest(coalesce(p_duplicados, 0), 0),
    addresses_without_number   = greatest(coalesce(p_sem_numero, 0), 0),
    -- Contagens por `group by` no banco. Carregar as linhas para contar em
    -- JavaScript funciona com 1.804 e falha calada na primeira base de 20 mil: o
    -- PostgREST devolve os primeiros `max_rows` e a contagem sai errada sem erro.
    created_count   = (select count(*) from public.import_rows where import_id = p_import_id and status = 'novo'),
    updated_count   = (select count(*) from public.import_rows where import_id = p_import_id and status = 'atualizado'),
    unchanged_count = (select count(*) from public.import_rows where import_id = p_import_id and status = 'inalterado'),
    conflict_count  = (select count(*) from public.import_rows where import_id = p_import_id and status = 'conflito'),
    error_count     = (select count(*) from public.import_rows where import_id = p_import_id and status = 'erro')
  where id = p_import_id
  returning * into v_job;

  if not found then
    raise exception 'Finalizar previa exige o papel de gestor master ou administrativo.'
      using errcode = '42501';
  end if;

  return v_job;
end;
$$;

-- ===========================================================================
-- 5. Descartar: por estado, com motivo, e sem apagar as linhas
-- ===========================================================================
-- `processando` E descartavel: e o estado do job interrompido, e e exatamente o
-- que o operador precisa limpar da lista. Se o descarte so aceitasse `previa`, o
-- job travado no meio ficaria sem saida e alguem resolveria por SQL direto.
--
-- `concluida` nao e: descartar o que ja foi aplicado nao desfaz nada e deixa o
-- historico mentindo sobre o que entrou na base.
create or replace function public.import_discard(
  p_import_id uuid,
  p_motivo    text
)
returns public.import_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_job    public.import_jobs;
  v_status public.import_job_status;
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Descartar exige motivo: e o que a auditoria registra.';
  end if;

  select status into v_status from public.import_jobs where id = p_import_id;
  if v_status is null then
    raise exception 'Importacao % nao encontrada, ou sem permissao de leitura.', p_import_id;
  end if;
  if v_status not in ('processando', 'previa') then
    raise exception
      'Importacao em estado % nao pode ser descartada. Descartar o que ja foi aplicado nao desfaz nada e deixa o historico mentindo sobre o que entrou na base.',
      v_status;
  end if;

  update public.import_jobs set
    status        = 'cancelada',
    finished_at   = now(),
    error_message = 'descartada: ' || btrim(p_motivo)
  where id = p_import_id
  returning * into v_job;

  if not found then
    raise exception 'Descartar importacao exige o papel de gestor master ou administrativo.'
      using errcode = '42501';
  end if;

  -- As linhas FICAM. Sao o registro do que alguem tentou importar, e e isso que
  -- se quer olhar depois quando a tentativa foi estranha. Apagar tornaria o
  -- descarte invisivel — o oposto de auditado.
  return v_job;
end;
$$;

-- ===========================================================================
-- 6. Escopo declarado x cidades do arquivo
-- ===========================================================================
-- O operador declara `scope_city`; o arquivo tem cidades; ninguem comparava os
-- dois. Declarar Sao Paulo e o arquivo trazer tres cidades significa que ou o
-- escopo esta errado ou o arquivo esta — e hoje isso so apareceria depois, como
-- ausente indevido, ou como dado de outra cidade entrando sob escopo alheio.
--
-- CRU, sem normalizar. Se o arquivo trouxer `São Paulo` e `SAO PAULO`, o operador
-- precisa ver as duas: normalizar antes de mostrar esconde justamente o que ele
-- deveria julgar. E COM A CONTAGEM POR GRAFIA — `São Paulo (1.803)` e
-- `SAO PAULO (1)` diz sujeira de origem; duas grafias com 900 cada diz outra
-- coisa completamente diferente.
--
-- Derivado de import_rows, sem coluna nova: duas fontes do mesmo fato ja custaram
-- caro tres vezes neste projeto.
create or replace function public.import_cities(p_import_id uuid)
returns table (cidade text, linhas bigint)
language sql
stable
set search_path = ''
as $$
  select r.raw_data ->> 'city', count(*)
    from public.import_rows r
   where r.import_id = p_import_id
   group by 1
   order by 2 desc, 1;
$$;

revoke execute on function public.import_create_preview(text, text) from public;
revoke execute on function public.import_finalize_preview(uuid, integer, integer, integer) from public;
revoke execute on function public.import_discard(uuid, text) from public;
revoke execute on function public.import_cities(uuid) from public;
grant execute on function public.import_create_preview(text, text) to authenticated;
grant execute on function public.import_finalize_preview(uuid, integer, integer, integer) to authenticated;
grant execute on function public.import_discard(uuid, text) to authenticated;
grant execute on function public.import_cities(uuid) to authenticated;

commit;
