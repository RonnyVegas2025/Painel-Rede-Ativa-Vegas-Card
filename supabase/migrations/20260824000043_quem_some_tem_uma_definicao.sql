-- 0043 "Quem some" passa a ter UMA definicao, e o descarte ganha caminho curto
--
-- ===========================================================================
-- 1. POR QUE UMA DEFINICAO, E NAO DUAS QUE COINCIDEM
-- ===========================================================================
-- A tela mostra "1.412 estabelecimentos serao marcados como ausentes" e pede que
-- o operador DIGITE esse numero. O commit conta por conta propria — de proposito,
-- porque trava que le campo gravado pela previa confia em quem deveria vigiar.
--
-- Mas "por conta propria" nao pode virar "por outra regra". Se as duas contagens
-- usassem predicados escritos separadamente, elas divergiriam no primeiro caso de
-- borda, e o operador aprovaria um numero e receberia outro — que e exatamente o
-- que a confirmacao deliberada existe para impedir.
--
-- `import_absent_establishments` e a definicao. A tela le por ela, o commit conta
-- por ela e marca por ela. Recalcular continua sendo recalcular; o que deixa de
-- existir e a segunda REGRA.
--
-- ===========================================================================
-- 2. O ELO QUE ISSO EXIGIU, E QUE FALTAVA DE QUALQUER JEITO
-- ===========================================================================
-- Numa linha `novo`, `import_rows.establishment_id` nasce nulo: o estabelecimento
-- ainda nao existe. O commit passa a preencher depois de criar.
--
-- Sem isso a definicao unica estaria ERRADA no momento da marcacao — todo
-- estabelecimento recem-criado apareceria como ausente na propria importacao que o
-- criou. Descoberto ao tentar aplicar a definicao unica, nao depois.
--
-- Independente disso, o elo faltava: "que estabelecimento a linha 266 criou?" nao
-- era pergunta que o schema respondesse.

begin;

alter table public.import_jobs
  add column derivado_de_id uuid references public.import_jobs(id);

comment on column public.import_jobs.derivado_de_id is
  'Aponta para a importacao descartada que originou esta. Preenchido quando o
   operador redeclara o escopo a partir da tela de confirmacao. Torna a historia
   legivel depois: "esta importacao foi redeclarada apos erro de escopo" e o rastro
   que alguem vai querer quando a base parecer estranha em marco.';

-- ===========================================================================
-- 3. A definicao
-- ===========================================================================
create or replace function public.import_absent_establishments(p_import_id uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select e.id
    from public.establishments e
    join public.import_jobs j on j.id = p_import_id
   where e.is_active
     and e.absent_since is null
     -- Nao veio nesta importacao. Cobre tanto o que foi identificado quanto o que
     -- foi criado por ela, porque o commit preenche establishment_id ao criar.
     and not exists (
       select 1 from public.import_rows r
        where r.import_id = p_import_id and r.establishment_id = e.id
     )
     -- Dentro do ESCOPO declarado. Sem isto, importar o recorte de uma cidade
     -- faria o resto da base inteira aparecer como sumido (ADR 0011).
     and (
       j.scope_city is null
       or exists (
         select 1 from public.establishment_addresses a
          where a.establishment_id = e.id and a.is_current and a.city = j.scope_city
       )
     );
$$;

comment on function public.import_absent_establishments is
  'A definicao de "quem some nesta importacao". UMA, usada pela tela de
   confirmacao, pela contagem do commit e pela marcacao. O commit continua
   RECALCULANDO em vez de ler um campo gravado pela previa — o que deixa de
   existir e uma segunda REGRA, que divergiria no primeiro caso de borda e faria o
   operador aprovar um numero e receber outro.';

-- ===========================================================================
-- 4. O que a tela le — numero, limiar, e os tres exemplos que decidem
-- ===========================================================================
-- Os exemplos sao os de TRANSACAO MAIS RECENTE, com a data, e nao tres quaisquer.
--
-- Um comercio que transacionou ontem aparecendo na lista de "vai virar ausente" e
-- o sinal mais forte possivel de que o escopo esta errado, e nao exige que o
-- operador entenda a trava: ele olha e sabe. Funciona nos dois sentidos — se os
-- tres mais recentes transacionaram ha oito meses, e evidencia de que a rede
-- encolheu mesmo, e confirmar passa a ser o caminho certo.
--
-- `excede` vem junto com o numero de proposito. A tela precisa saber se AINDA
-- excede, nao so quanto e: se outra importacao rodou nesse meio-tempo e o total
-- caiu abaixo do limiar, exigir digitacao vira atrito sem motivo — e atrito sem
-- motivo e o que corroi a trava.
create or replace function public.import_absent_summary(p_import_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_job       public.import_jobs;
  v_ausentes  integer;
  v_no_escopo integer;
  v_limiar    integer;
  v_exemplos  jsonb;
begin
  -- A RLS de import_jobs decide quem enxerga. Papel sem acesso ve nulo aqui, e a
  -- funcao para antes de contar qualquer coisa.
  select * into v_job from public.import_jobs where id = p_import_id;
  if v_job.id is null then
    raise exception 'Importacao % nao encontrada, ou sem permissao de leitura.', p_import_id;
  end if;

  select count(*) into v_ausentes from public.import_absent_establishments(p_import_id) as a;

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

  select (value #>> '{}')::integer into v_limiar
    from public.system_settings where key = 'import_missing_threshold_percent';

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'trade_name',          t.trade_name,
             'last_transaction_at', t.last_transaction_at,
             'never_transacted',    t.never_transacted
           ) order by t.ordem
         ), '[]'::jsonb)
    into v_exemplos
  from (
    select e.trade_name, e.last_transaction_at, e.never_transacted,
           row_number() over (
             order by e.never_transacted, e.last_transaction_at desc nulls last
           ) as ordem
      from public.establishments e
     where e.id in (select * from public.import_absent_establishments(p_import_id))
     order by e.never_transacted, e.last_transaction_at desc nulls last
     limit 3
  ) as t;

  return jsonb_build_object(
    'ausentes',   v_ausentes,
    'no_escopo',  v_no_escopo,
    'percentual', case when v_no_escopo = 0 then 0
                       else round(v_ausentes::numeric * 100 / v_no_escopo, 1) end,
    'limiar',     v_limiar,
    'excede',     v_no_escopo > 0
                  and v_limiar is not null
                  and (v_ausentes::numeric * 100 / v_no_escopo) > v_limiar,
    'exemplos',   v_exemplos
  );
end;
$$;

-- ===========================================================================
-- 5. O caminho curto: descartar E redeclarar numa acao
-- ===========================================================================
-- Sem isto, o caminho certo e: descartar, voltar a lista, subir 20 MB de novo,
-- declarar o escopo. O caminho errado e digitar 1.412. O ERRADO E MAIS CURTO — e a
-- licao do PLATFORM-STANDARDS secao 8 diz o que acontece quando isso e verdade.
-- Tornar a saida visivel nao basta; ela precisa ser mais curta.
--
-- O objeto do bucket e COPIADO pelo lado Node para o caminho do job novo, nao
-- reaproveitado: cada job mantem seu artefato imutavel, que e o que "evidencia"
-- significa. A RPC devolve os dois caminhos para a copia acontecer.
create or replace function public.import_redeclare_scope(
  p_import_id  uuid,
  p_scope_city text,
  p_observacao text default null
)
returns public.import_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_antigo public.import_jobs;
  v_novo   public.import_jobs;
begin
  select * into v_antigo from public.import_jobs where id = p_import_id;
  if v_antigo.id is null then
    raise exception 'Importacao % nao encontrada, ou sem permissao de leitura.', p_import_id;
  end if;

  if coalesce(btrim(p_scope_city), '') = '' then
    raise exception 'O novo escopo e obrigatorio: redeclarar sem escopo repete o erro.';
  end if;

  if btrim(p_scope_city) = coalesce(v_antigo.scope_city, '') then
    raise exception
      'O escopo informado e igual ao atual (%). Redeclarar para o mesmo valor daria o mesmo resultado.',
      v_antigo.scope_city;
  end if;

  -- Descarta pela mesma funcao, com as mesmas regras de estado. O motivo e gravado
  -- pelo CONTEXTO: cobrar texto livre poria atrito no caminho recomendado, que e o
  -- erro que este desenho inteiro existe para evitar.
  perform public.import_discard(
    p_import_id,
    'escopo redeclarado para ' || btrim(p_scope_city)
      || case when coalesce(btrim(p_observacao), '') = '' then ''
              else ' — ' || btrim(p_observacao) end
  );

  select * into v_novo
    from public.import_create_preview(v_antigo.file_name, btrim(p_scope_city));

  update public.import_jobs
     set derivado_de_id = p_import_id
   where id = v_novo.id
  returning * into v_novo;

  return v_novo;
end;
$$;

revoke execute on function public.import_absent_establishments(uuid) from public;
revoke execute on function public.import_absent_summary(uuid) from public;
revoke execute on function public.import_redeclare_scope(uuid, text, text) from public;
grant execute on function public.import_absent_establishments(uuid) to authenticated;
grant execute on function public.import_absent_summary(uuid) to authenticated;
grant execute on function public.import_redeclare_scope(uuid, text, text) to authenticated;

commit;

-- ===========================================================================
-- 6. O commit passa a usar a definicao unica, e a preencher o elo
-- ===========================================================================
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
begin
  if v_uid is null then
    raise exception 'Importacao exige usuario identificado: o commit registra quem aplicou.';
  end if;

  -- A FRONTEIRA DE PAPEL, QUE FALTAVA
  --
  -- `security definer` faz esta funcao rodar com o privilegio do dono: a RLS de
  -- establishments, segments e capture_methods NAO e avaliada aqui dentro. Sem
  -- esta linha, `grant execute ... to authenticated` era o unico controle — e ele
  -- so pergunta "esta logado?".
  --
  -- Verificado antes de corrigir: um `consultor_campo` chamou import_commit e
  -- criou estabelecimento. As policies existiam e estavam certas; simplesmente
  -- nao eram consultadas neste caminho.
  --
  -- Mesma familia dos outros: a protecao morava numa etapa que este caminho nao
  -- percorre. `is_admin()` = gestor_master + administrativo = importacao.executar
  -- na matriz (src/lib/permissions/matrix.ts).
  if not public.is_admin() then
    raise exception
      'Aplicar importacao exige o papel de gestor master ou administrativo. Papel atual: %.',
      coalesce(public.auth_role()::text, 'nenhum')
      using errcode = '42501';
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

  -- A MESMA definicao que a tela leu. Dois lugares calculando "quem some"
  -- divergem, e o operador aprovaria um numero e receberia outro — que e
  -- exatamente o que a confirmacao deliberada existe para impedir.
  select count(*) into v_previstos
    from public.import_absent_establishments(p_import_id) as a;

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

      -- O ELO QUE FALTAVA, e que a definicao unica de "quem some" precisa.
      --
      -- Numa linha `novo`, establishment_id nasce nulo porque o estabelecimento
      -- ainda nao existia. Sem preencher, "identificado por esta importacao" nao
      -- e pergunta que import_rows responda — e o recem-criado apareceria como
      -- AUSENTE na propria importacao que o criou.
      --
      -- Nao fere a imutabilidade da linha: o conteudo (raw_data, status,
      -- line_number) nunca muda. Este e o ponteiro de RESULTADO, e o commit e o
      -- unico que escreve — nao ha policy de UPDATE para ninguem mais.
      -- De quebra, torna respondivel "que estabelecimento a linha 266 criou?".
      update public.import_rows set establishment_id = v_est_id where id = v_linha.id;

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
   where id in (
           select r.establishment_id from public.import_rows r
            where r.import_id = p_import_id and r.establishment_id is not null
         )
     and absent_since is not null;

  -- A mesma funcao de novo. Ela so esta correta aqui porque o laco preencheu
  -- establishment_id nas linhas `novo`: sem isso, todo estabelecimento
  -- recem-criado seria marcado como ausente pela importacao que o criou.
  update public.establishments e
     set absent_since = now(),
         absent_from_import = p_import_id
   where e.id in (select * from public.import_absent_establishments(p_import_id));
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
