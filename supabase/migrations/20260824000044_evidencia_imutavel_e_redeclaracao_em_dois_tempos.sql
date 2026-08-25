-- 0044 A imutabilidade de import_rows deixa de ser convencao, e a redeclaracao
--      deixa de poder perder os dois jobs
--
-- ===========================================================================
-- 1. "O commit e o unico escritor" descrevia comportamento, nao garantia
-- ===========================================================================
-- A 0043 justificou preencher `establishment_id` assim: raw_data, status e
-- line_number nunca mudam, e o commit e o unico que escreve. A segunda metade e
-- verdadeira HOJE e nao esta garantida em lugar nenhum.
--
-- Nao ha policy de UPDATE, entao usuario nenhum escreve — isso continua valendo.
-- Mas `import_commit` e `security definer` e passa por cima da RLS. A partir da
-- 0043, a imutabilidade da evidencia passou a depender de o commit continuar se
-- comportando. Esta sprint produziu cinco defeitos exatamente dessa forma.
--
-- O trigger vale contra `security definer`, contra SQL direto no banco e contra a
-- proxima versao do commit — que e o unico dos tres que a revisao de codigo teria
-- chance de pegar, e so se alguem lembrasse de procurar.

create or replace function public.fn_import_rows_imutavel()
returns trigger
language plpgsql
as $$
begin
  if new.raw_data    is distinct from old.raw_data
     or new.status      is distinct from old.status
     or new.line_number is distinct from old.line_number
     or new.import_id   is distinct from old.import_id
     -- O elo e gravavel UMA VEZ: de nulo para valor. Reapontar a linha para outro
     -- estabelecimento reescreveria o que aquela importacao produziu.
     or (old.establishment_id is not null
         and new.establishment_id is distinct from old.establishment_id)
  then
    raise exception
      'import_rows e evidencia: so o elo de resultado (establishment_id) e gravavel, e uma vez.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.fn_import_rows_imutavel is
  'Torna estrutural o que era convencao. `import_commit` e security definer e
   ignora a RLS: sem este trigger, a imutabilidade da linha crua dependeria de a
   proxima versao do commit continuar se comportando.';

create trigger import_rows_imutavel
  before update on public.import_rows
  for each row execute function public.fn_import_rows_imutavel();

-- ===========================================================================
-- 2. A redeclaracao em dois tempos
-- ===========================================================================
-- A 0043 descartava o original e criava o novo na mesma transacao. A copia do
-- objeto no Storage acontece DEPOIS, no Node — o Postgres nao fala com Storage.
--
-- Se a copia falhasse, o operador ficava sem nenhum dos dois: o original
-- descartado, o novo sem arquivo, e os 20 MB ja subidos.
--
-- Agora sao dois tempos. O original so e descartado quando a copia deu certo:
--
--   1. import_redeclare_scope  -> cria o novo em `processando`, com derivado_de_id.
--                                 O ORIGINAL NAO E TOCADO.
--   2. Node copia o objeto.
--   3a. copia ok    -> import_finish_redeclaration(novo) descarta o original.
--   3b. copia falha -> import_discard(novo, motivo) e o original continua intacto.
--
-- Entre 1 e 3 existem dois jobs vivos. E transitorio e visivel, e a alternativa e
-- perder os dois — que e pior e silencioso.
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

  if v_antigo.status not in ('processando', 'previa') then
    raise exception
      'Importacao em estado % nao pode ser redeclarada: ela ja saiu da revisao.',
      v_antigo.status;
  end if;

  if exists (select 1 from public.import_jobs where derivado_de_id = p_import_id) then
    raise exception
      'Esta importacao ja foi redeclarada. Abra a importacao derivada em vez de criar outra.';
  end if;

  if coalesce(btrim(p_scope_city), '') = '' then
    raise exception 'O novo escopo e obrigatorio: redeclarar sem escopo repete o erro.';
  end if;

  -- Recusa sem alternativa e o que empurra para o contorno: a mensagem diz o que
  -- fazer quando o problema era o arquivo, e nao o escopo.
  if btrim(p_scope_city) = coalesce(v_antigo.scope_city, '') then
    raise exception
      'O escopo informado (%) e igual ao atual. Mesmo arquivo e mesmo escopo produzem o mesmo resultado. Se o problema era o ARQUIVO, descarte esta previa e envie outro; se era o escopo, informe o correto.',
      v_antigo.scope_city;
  end if;

  select * into v_novo
    from public.import_create_preview(v_antigo.file_name, btrim(p_scope_city));

  update public.import_jobs
     set derivado_de_id = p_import_id,
         error_message  = case when coalesce(btrim(p_observacao), '') = '' then null
                               else 'redeclarada: ' || btrim(p_observacao) end
   where id = v_novo.id
  returning * into v_novo;

  return v_novo;
end;
$$;

comment on function public.import_redeclare_scope is
  'Primeiro tempo da redeclaracao: cria a importacao derivada e NAO toca a
   original. O descarte da original so acontece em import_finish_redeclaration,
   depois de a copia do arquivo dar certo — descartar antes deixaria o operador sem
   nenhum dos dois, com os 20 MB ja enviados.';

create or replace function public.import_finish_redeclaration(p_novo_id uuid)
returns public.import_jobs
language plpgsql
set search_path = ''
as $$
declare
  v_novo   public.import_jobs;
  v_antigo public.import_jobs;
begin
  select * into v_novo from public.import_jobs where id = p_novo_id;
  if v_novo.id is null then
    raise exception 'Importacao % nao encontrada, ou sem permissao de leitura.', p_novo_id;
  end if;
  if v_novo.derivado_de_id is null then
    raise exception 'Importacao % nao e uma redeclaracao: nao ha original a descartar.', p_novo_id;
  end if;

  select * into v_antigo from public.import_jobs where id = v_novo.derivado_de_id;

  -- Idempotente: a copia pode ter dado certo e a chamada seguinte ter caido.
  if v_antigo.status in ('processando', 'previa') then
    perform public.import_discard(
      v_antigo.id,
      'escopo redeclarado para ' || v_novo.scope_city
    );
  end if;

  return v_novo;
end;
$$;

comment on function public.import_finish_redeclaration is
  'Segundo tempo: descarta a importacao original, agora que o arquivo ja foi
   copiado para o caminho da derivada. Idempotente — a copia pode ter dado certo e
   a chamada seguinte ter caido.';

revoke execute on function public.import_finish_redeclaration(uuid) from public;
grant execute on function public.import_finish_redeclaration(uuid) to authenticated;
