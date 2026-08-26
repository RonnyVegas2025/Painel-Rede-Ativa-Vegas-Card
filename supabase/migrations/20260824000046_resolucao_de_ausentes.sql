-- 0046 A resolucao de ausentes: a fila que o ADR 0011 previu e nao tinha onde acontecer
--
-- ===========================================================================
-- A DECISAO QUE ESTA MIGRATION FECHA: ausencia NAO grava `encerrado`
-- ===========================================================================
-- A pergunta era se "confirmar encerramento" deveria gravar
-- `operational_status = encerrado`. O projeto ja tinha respondido, em dois lugares
-- que ninguem tinha cruzado:
--
--   src/constants/operational-status.ts, primeira linha:
--     "Dimensao operacional: CONFIRMADA EM CAMPO."
--
--   docs/status-flows.md:
--     "`encerrado` e definitivo e confirmado."
--     "`fechado_temporariamente` nao e `encerrado`. Confundir os dois derruba
--      comercio ativo."
--
-- Ausencia numa planilha nao e confirmacao em campo. E evidencia mais fraca que o
-- consultor na porta: o comercio pode ter trocado de adquirente, saido do recorte
-- exportado, ou o arquivo pode ter vindo filtrado — que e justamente o caso que a
-- trava de 20% existe para pegar.
--
-- Entao o caminho administrativo grava `fechado_temporariamente`, e so a visita
-- confirma `encerrado`. O proprio diagrama de status-flows.md ja previa a
-- transicao `fechado_temporariamente -> encerrado`; o que faltava era alguem
-- notar que a origem administrativa entra na PRIMEIRA.
--
-- A GARANTIA E ESTRUTURAL, NAO DOCUMENTAL: a RPC nao recebe status por parametro.
-- Nao ha como pedir `encerrado` a ela — nao existe o argumento. Guarda que depende
-- de a proxima pessoa ler o comentario nao e guarda.

begin;

create type public.absence_resolution as enum (
  -- Reaparecerá na proxima importacao, ou ja foi verificado por telefone.
  'voltou_a_operar',
  -- O arquivo era um recorte. E o caso MAIS PROVAVEL quando ha centenas de uma
  -- vez: ninguem perde 1.412 comercios num mes.
  'escopo_incorreto',
  -- Nao opera mais. Grava `fechado_temporariamente`, NUNCA `encerrado`.
  'nao_opera_mais'
);

create table public.absence_resolutions (
  id                uuid primary key default gen_random_uuid(),
  establishment_id  uuid not null references public.establishments(id) on delete cascade,
  resolution        public.absence_resolution not null,
  reason            text not null,
  -- Desde quando estava ausente, no momento da resolucao. Copiado de proposito:
  -- `absent_since` e limpo pela resolucao, e sem isto a pergunta "quanto tempo
  -- ficou na fila" deixaria de ter resposta no dia seguinte.
  was_absent_since  timestamptz,
  absent_from_import uuid references public.import_jobs(id),
  resolved_by       uuid references public.profiles(id),
  resolved_at       timestamptz not null default now(),
  constraint absence_resolutions_motivo_nao_vazio check (btrim(reason) <> '')
);

create index absence_resolutions_por_estabelecimento
  on public.absence_resolutions (establishment_id, resolved_at desc);

comment on table public.absence_resolutions is
  'Historico das decisoes sobre ausencia. Sem isto, resolver a fila apagaria a
   marca e a decisao sumiria junto — e em tres meses ninguem distinguiria "sumiu
   ontem" de "sumiu em marco e ja foi verificado", que e o problema que a fila
   existe para resolver.';

alter table public.absence_resolutions enable row level security;

create policy "gestao le resolucoes de ausencia"
  on public.absence_resolutions for select to authenticated using (public.is_admin());

create policy "gestao registra resolucao de ausencia"
  on public.absence_resolutions for insert to authenticated with check (public.is_admin());

-- Sem UPDATE nem DELETE, e a imutabilidade e estrutural: a licao do import_rows
-- foi que ausencia de policy nao protege contra `security definer` nem contra SQL
-- direto, e que "so o codigo X escreve" descreve comportamento, nao garantia.
create or replace function public.fn_absence_resolutions_imutavel()
returns trigger language plpgsql as $$
begin
  raise exception 'absence_resolutions e historico: a decisao registrada nao muda.'
    using errcode = 'check_violation';
end;
$$;

create trigger absence_resolutions_imutavel
  before update or delete on public.absence_resolutions
  for each row execute function public.fn_absence_resolutions_imutavel();

grant select, insert on public.absence_resolutions to authenticated;

commit;

-- ===========================================================================
-- A acao
-- ===========================================================================
begin;

create or replace function public.resolve_absences(
  p_ids        uuid[],
  p_resolution public.absence_resolution,
  p_reason     text,
  -- Confirmacao deliberada para LOTE de `nao_opera_mais`. Nulo nos demais casos.
  p_confirmada_quantidade integer default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_n    integer := coalesce(array_length(p_ids, 1), 0);
  v_feitas integer := 0;
begin
  if v_uid is null then
    raise exception 'Resolver ausencia exige usuario identificado: a decisao registra quem decidiu.';
  end if;
  if v_n = 0 then
    raise exception 'Nenhum estabelecimento selecionado.';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Resolver ausencia exige motivo: e o que fica no historico.';
  end if;

  -- ASSIMETRIA DELIBERADA.
  --
  -- Desmarcar e reversivel: o registro volta ao estado anterior e a proxima
  -- importacao decide de novo. Lote sem atrito.
  --
  -- `nao_opera_mais` muda a dimensao OPERACIONAL, que sai das listas de aptos.
  -- Em lote exige a mesma confirmacao deliberada da trava de importacao — digitar
  -- a quantidade —, e por item nao exige nada: atrito em todo lugar e atrito em
  -- lugar nenhum.
  if p_resolution = 'nao_opera_mais' and v_n > 1
     and coalesce(p_confirmada_quantidade, -1) <> v_n then
    raise exception
      'Marcar % estabelecimentos como fora de operacao exige confirmar a quantidade. Se sao centenas de uma vez, o escopo do arquivo provavelmente estava errado — ninguem perde % comercios num mes.',
      v_n, v_n;
  end if;

  -- O historico primeiro: `absent_since` e limpo em seguida, e copiar depois
  -- perderia o valor.
  insert into public.absence_resolutions
    (establishment_id, resolution, reason, was_absent_since, absent_from_import, resolved_by)
  select e.id, p_resolution, btrim(p_reason), e.absent_since, e.absent_from_import, v_uid
    from public.establishments e
   where e.id = any(p_ids) and e.absent_since is not null;

  get diagnostics v_feitas = row_count;
  if v_feitas = 0 then
    raise exception 'Nenhum dos estabelecimentos selecionados esta marcado como ausente.';
  end if;

  update public.establishments e
     set absent_since = null,
         absent_from_import = null,
         operational_status = case
           -- `fechado_temporariamente`, NUNCA `encerrado`: ausencia na planilha
           -- nao e confirmacao em campo. So a visita confirma o definitivo.
           when p_resolution = 'nao_opera_mais' then 'fechado_temporariamente'
           else e.operational_status
         end
   where e.id = any(p_ids) and e.absent_since is not null;

  return v_feitas;
end;
$$;

comment on function public.resolve_absences is
  'Resolve a fila de ausentes. NAO recebe status por parametro, de proposito: nao
   ha como pedir `encerrado` a ela porque nao existe o argumento. Ausencia numa
   planilha e evidencia mais fraca que o consultor na porta, e a dimensao
   operacional e definida como confirmada em campo — entao o caminho
   administrativo para em `fechado_temporariamente` e a visita confirma o resto.';

revoke execute on function public.resolve_absences(uuid[], public.absence_resolution, text, integer) from public;
grant execute on function public.resolve_absences(uuid[], public.absence_resolution, text, integer) to authenticated;

commit;
