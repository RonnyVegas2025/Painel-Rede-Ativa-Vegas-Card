-- 0037 Reaparecer no arquivo desmarca a ausencia — para qualquer status
--
-- O DEFEITO
--
-- A 0035 limpava `absent_since` dentro do ramo `atualizado`. Um estabelecimento
-- marcado como ausente que REAPARECE no arquivo seguinte sem nenhuma mudanca
-- volta como `inalterado`, o ramo nao toca a linha, e a marca fica para sempre.
--
-- O caso mais comum e justamente o que falhava: a maioria das linhas volta
-- inalterada. Verificado no banco antes de corrigir — a linha continuava
-- "ausente desde" uma data de tres meses atras depois de reaparecer.
--
-- A CAUSA, QUE E A MESMA DE OUTRAS TRES DESTA SPRINT
--
-- `atualizado` responde "o dado mudou?". Desmarcar depende de "apareceu no
-- arquivo?". Sao perguntas diferentes, e uma foi usada como se fosse a outra —
-- pela quarta vez nesta sprint (policy sem GRANT, view ignorando RLS, trava
-- lendo campo que a previa poderia esquecer, e agora esta).
--
-- Registrado como padrao em PLATFORM-STANDARDS.md secao 8.
--
-- A CORRECAO
--
-- Um unico `update` depois do laco, sobre quem foi identificado. Fora do ramo,
-- porque nao depende dele. E em UM lugar so: manter a limpeza tambem dentro do
-- `atualizado` deixaria a mesma decisao escrita em dois pontos livres para
-- divergir, que e a classe de defeito que o arnes de paridade existe para
-- eliminar e que ja apareceu duas vezes aqui.
--
-- `where absent_since is not null` NAO E OTIMIZACAO
--
-- Sem ele, o update toca as 1.804 linhas que nunca estiveram marcadas. O gatilho
-- `fn_touch_updated_at` dispara em todas, e a impressao digital de `updated_at`
-- que prova a idempotencia da segunda passada muda sem nenhum dado ter mudado —
-- envenenando exatamente a evidencia que existe para detectar isso.
--
-- Nao ha contador de "reapareceram" no job: a transicao ja fica na trilha, com o
-- momento em que ocorreu, porque `fn_audit` grava `absent_since` em
-- `changed_fields`. Coluna nova seria um segundo registro do mesmo fato.

begin;

create or replace function public.import_commit(p_import_id uuid)
returns public.import_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.import_jobs;
  v_inicio timestamptz := clock_timestamp();
  v_uid uuid := (select auth.uid());
  v_criados integer := 0;
  v_atualizados integer := 0;
  v_inalterados integer := 0;
  v_ausentes integer := 0;
  v_no_escopo integer := 0;
  v_previstos integer := 0;
  v_limiar integer;
  v_linha record;
  v_est_id uuid;
  v_seg_id uuid;
  v_metodo_id uuid;
  v_metodo text;
  v_criar boolean;
  v_identificados uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Importacao exige usuario identificado: o commit registra quem aplicou.';
  end if;

  set local statement_timeout = '120s';
  perform set_config('app.audit_origin', 'import', true);

  update public.import_jobs
     set status = 'aplicando'
   where id = p_import_id and status = 'previa'
  returning * into v_job;

  if not found then
    select * into v_job from public.import_jobs where id = p_import_id;
    if v_job.id is null then
      raise exception 'Importacao % nao encontrada', p_import_id;
    end if;
    return v_job;
  end if;

  -- Trava de ausentes: CALCULADA aqui, antes de qualquer escrita no dominio.
  select count(*) into v_no_escopo
    from public.establishments e
   where e.is_active
     and (
       v_job.scope_city is null
       or exists (
         select 1 from public.establishment_addresses a
          where a.establishment_id = e.id and a.is_current and a.city = v_job.scope_city
       )
     );

  select count(*) into v_previstos
    from public.establishments e
   where e.is_active
     and e.absent_since is null
     and not exists (
       select 1 from public.import_rows r
        where r.import_id = p_import_id
          and r.establishment_id = e.id
     )
     and (
       v_job.scope_city is null
       or exists (
         select 1 from public.establishment_addresses a
          where a.establishment_id = e.id and a.is_current and a.city = v_job.scope_city
       )
     );

  select (value #>> '{}')::integer into v_limiar
    from public.system_settings where key = 'import_missing_threshold_percent';

  if v_limiar is null then
    raise exception
      'Parametro import_missing_threshold_percent ausente: sem limiar nao ha como avaliar a importacao.';
  end if;

  if v_no_escopo > 0
     and (v_previstos::numeric * 100 / v_no_escopo) > v_limiar
     and v_job.confirmed_at is null
  then
    raise exception
      'Importacao marcaria % de % registros no escopo como ausentes (%), acima do limiar de %. Confirmacao explicita necessaria.',
      v_previstos, v_no_escopo,
      round(v_previstos::numeric * 100 / v_no_escopo, 1)::text || '%',
      v_limiar::text || '%';
  end if;

  insert into public.capture_methods (source_name, name)
  select distinct m.valor, m.valor
  from public.import_rows r
  cross join lateral jsonb_array_elements_text(
    coalesce(r.raw_data -> 'capture_methods', '[]'::jsonb)
  ) as m(valor)
  where r.import_id = p_import_id
    and r.status in ('novo', 'atualizado', 'inalterado', 'conflito')
  on conflict (source_name) do nothing;

  insert into public.segments (source_name, normalized_name, category, cnae_hint)
  select distinct
    r.raw_data ->> 'segment_source_name',
    r.raw_data ->> 'segment_source_name',
    'outros',
    r.raw_data ->> 'cnae_hint'
  from public.import_rows r
  where r.import_id = p_import_id
    and r.status in ('novo', 'atualizado', 'inalterado', 'conflito')
    and coalesce(r.raw_data ->> 'segment_source_name', '') <> ''
  on conflict (source_name) do nothing;

  for v_linha in
    select * from public.import_rows
     where import_id = p_import_id
       and status in ('novo', 'atualizado', 'inalterado', 'conflito')
     order by line_number
  loop
    select id into v_seg_id from public.segments
     where source_name = v_linha.raw_data ->> 'segment_source_name';

    v_criar := v_linha.establishment_id is null;

    if v_criar then
      insert into public.establishments (
        external_contract, cnpj, legal_name, trade_name, segment_id,
        relationship_start_date, last_transaction_at, never_transacted,
        phone, email, origin, acquisition_channel, assigned_consultants_raw,
        description
      ) values (
        nullif(v_linha.raw_data ->> 'external_contract', ''),
        nullif(v_linha.raw_data ->> 'cnpj', ''),
        v_linha.raw_data ->> 'legal_name',
        v_linha.raw_data ->> 'trade_name',
        v_seg_id,
        nullif(v_linha.raw_data ->> 'relationship_start_date', '')::date,
        nullif(v_linha.raw_data ->> 'last_transaction_at', '')::timestamptz,
        coalesce((v_linha.raw_data ->> 'never_transacted')::boolean, false),
        nullif(v_linha.raw_data ->> 'phone', ''),
        nullif(v_linha.raw_data ->> 'email', ''),
        nullif(v_linha.raw_data ->> 'origin', ''),
        nullif(v_linha.raw_data ->> 'acquisition_channel', ''),
        nullif(v_linha.raw_data ->> 'assigned_consultants_raw', ''),
        nullif(v_linha.raw_data ->> 'description', '')
      )
      returning id into v_est_id;
      v_criados := v_criados + 1;

    else
      v_est_id := v_linha.establishment_id;

      if v_linha.status = 'atualizado' then
        -- `absent_since` NAO entra aqui: desmarcar nao depende de o dado ter
        -- mudado. A limpeza acontece uma vez so, depois do laco.
        update public.establishments set
          legal_name = v_linha.raw_data ->> 'legal_name',
          trade_name = v_linha.raw_data ->> 'trade_name',
          segment_id = v_seg_id,
          relationship_start_date = nullif(v_linha.raw_data ->> 'relationship_start_date', '')::date,
          last_transaction_at = nullif(v_linha.raw_data ->> 'last_transaction_at', '')::timestamptz,
          never_transacted = coalesce((v_linha.raw_data ->> 'never_transacted')::boolean, false),
          phone = nullif(v_linha.raw_data ->> 'phone', ''),
          email = nullif(v_linha.raw_data ->> 'email', ''),
          origin = nullif(v_linha.raw_data ->> 'origin', ''),
          acquisition_channel = nullif(v_linha.raw_data ->> 'acquisition_channel', ''),
          assigned_consultants_raw = nullif(v_linha.raw_data ->> 'assigned_consultants_raw', ''),
          description = nullif(v_linha.raw_data ->> 'description', '')
        where id = v_est_id;
        v_atualizados := v_atualizados + 1;
      else
        v_inalterados := v_inalterados + 1;
      end if;
    end if;

    v_identificados := v_identificados || v_est_id;

    if v_criar or v_linha.status = 'atualizado' then
      update public.establishment_addresses
         set is_current = false
       where establishment_id = v_est_id and is_current;

      insert into public.establishment_addresses (
        establishment_id, street, street_name, street_number, district,
        cep, city, state, is_current
      ) values (
        v_est_id,
        v_linha.raw_data ->> 'endereco_bruto',
        nullif(v_linha.raw_data ->> 'street_name', ''),
        nullif(v_linha.raw_data ->> 'street_number', ''),
        nullif(v_linha.raw_data ->> 'district', ''),
        nullif(v_linha.raw_data ->> 'cep', ''),
        v_linha.raw_data ->> 'city',
        v_linha.raw_data ->> 'state',
        true
      );
    end if;

    for v_metodo in
      select value from jsonb_array_elements_text(
        coalesce(v_linha.raw_data -> 'capture_methods', '[]'::jsonb)
      )
    loop
      select id into v_metodo_id from public.capture_methods where source_name = v_metodo;
      insert into public.establishment_capture_points
        (establishment_id, capture_method_id, status, inactivated_at, inactivated_by_import)
      values (v_est_id, v_metodo_id, 'ativo', null, null)
      on conflict (establishment_id, capture_method_id)
        where capture_method_id is not null
      do update set status = 'ativo', inactivated_at = null, inactivated_by_import = null;
    end loop;

    update public.establishment_capture_points p
       set status = 'inativo',
           inactivated_at = now(),
           inactivated_by_import = p_import_id
     where p.establishment_id = v_est_id
       and p.status <> 'inativo'
       and p.capture_method_id is not null
       and not exists (
         select 1
         from jsonb_array_elements_text(
           coalesce(v_linha.raw_data -> 'capture_methods', '[]'::jsonb)
         ) as m(valor)
         join public.capture_methods cm on cm.source_name = m.valor
         where cm.id = p.capture_method_id
       );
  end loop;

  -- REAPARECEU: a marca sai, qualquer que tenha sido o status da linha.
  -- `absent_since is not null` evita tocar quem nunca esteve marcado — o gatilho
  -- de updated_at dispararia em todas e a impressao digital que prova a
  -- idempotencia mudaria sem nenhum dado ter mudado.
  update public.establishments
     set absent_since = null,
         absent_from_import = null
   where id = any(v_identificados)
     and absent_since is not null;

  update public.establishments e
     set absent_since = now(),
         absent_from_import = p_import_id
   where e.is_active
     and e.absent_since is null
     and not (e.id = any(v_identificados))
     and (
       v_job.scope_city is null
       or exists (
         select 1 from public.establishment_addresses a
          where a.establishment_id = e.id and a.is_current and a.city = v_job.scope_city
       )
     );
  get diagnostics v_ausentes = row_count;

  update public.import_jobs set
    status = 'concluida',
    finished_at = now(),
    created_count = v_criados,
    updated_count = v_atualizados,
    unchanged_count = v_inalterados,
    missing_count = v_ausentes,
    error_message = format('duracao: %s', clock_timestamp() - v_inicio)
  where id = p_import_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.import_commit is
  'Aplica ao dominio o que a previa classificou em import_rows. NAO reclassifica —
   mas CONTA os ausentes por conta propria antes de escrever, porque trava que le
   campo gravado pela previa confia em quem deveria vigiar. Criar ou nao criar sai
   de `establishment_id is null`, nao de `status`. Reaparecer no arquivo desmarca a
   ausencia para QUALQUER status — desmarcar depende de "apareceu?", nao de "mudou?".
   Idempotente contra repeticao pelo estado do job. Ausentes sao marcados, nunca
   apagados, e so dentro do escopo declarado (ADR 0011).';

revoke execute on function public.import_commit(uuid) from public;
grant execute on function public.import_commit(uuid) to authenticated;

commit;
