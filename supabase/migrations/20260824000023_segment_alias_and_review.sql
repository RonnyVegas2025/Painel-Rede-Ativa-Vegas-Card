-- 0023 Fila de normalizacao: alias canonico e estado de revisao
--
-- PROBLEMA 1 — "mapear para segmento existente" nao cabia no schema
--
-- `segments.source_name` e unico e e a chave de reconciliacao da importacao.
-- Mapear `PADARIA E CONFEITARIA` para `Padaria` significa dois source_name
-- distintos designando o mesmo segmento de negocio, e nao havia como expressar.
--
-- As duas saidas obvias falham:
--
--   Desativar o duplicado. A proxima importacao encontra o source_name — ele
--   existe, esta inativo — e passa a vincular estabelecimentos a segmento
--   inativo. A elegibilidade some outra vez, agora sem nem aparecer na fila.
--
--   Apagar o duplicado. Quebra a reconciliacao: a importacao seguinte o recria e
--   a fila reabre o mesmo item, para sempre.
--
-- SOLUCAO: `canonical_segment_id`, auto-referencia anulavel. Segmento com
-- canonico preenchido e ALIAS: mantem o source_name, entao a reconciliacao
-- continua casando e a importacao nunca recria duplicata; a elegibilidade e a
-- exibicao resolvem pelo canonico.
--
-- Um nivel so, garantido de forma DECLARATIVA em vez de por trigger. Duas colunas
-- geradas e uma FK composta:
--
--   eh_canonico    = (canonical_segment_id is null)
--   aponta_canonico= null quando nao ha alias; true quando ha
--
-- A FK (canonical_segment_id, aponta_canonico) -> (id, eh_canonico) so e avaliada
-- quando aponta_canonico nao e nulo, por MATCH SIMPLE, e entao exige alvo com
-- eh_canonico = true. Alias apontando para alias e recusado pelo banco.
--
-- Efeito colateral desejado: promover um canonico a alias enquanto ha aliases
-- apontando para ele tambem e recusado, porque quebraria a FK dos que apontam.
--
-- PROBLEMA 2 — a fila nunca esvaziava
--
-- Sem estado de revisao, "pendente" teria de ser inferido de `category = 'outros'`
-- mais ausencia de vinculo. Um segmento que LEGITIMAMENTE e `outros`, e que
-- alguem ja olhou e confirmou, voltaria a fila em toda abertura da tela. Duas
-- semanas assim e ninguem olha mais — o mesmo destino da trava de limiar de
-- ausentes se ela nao existisse.
--
-- `reviewed_at` e `reviewed_by`: pendente e `reviewed_at is null`. Isso torna
-- "confirmar como esta" uma quarta acao legitima da tela, que provavelmente e a
-- mais frequente e que nao existia no desenho anterior.

begin;

alter table public.segments
  add column canonical_segment_id uuid,
  add column reviewed_at          timestamptz,
  add column reviewed_by          uuid references public.profiles(id);

-- Colunas geradas que sustentam a FK de um nivel.
alter table public.segments
  add column eh_canonico boolean
    generated always as (canonical_segment_id is null) stored,
  add column aponta_canonico boolean
    generated always as (case when canonical_segment_id is null then null else true end) stored;

alter table public.segments
  add constraint segments_alias_nao_aponta_para_si
    check (canonical_segment_id is null or canonical_segment_id <> id),
  -- Revisao e ato completo: quem e quando andam juntos.
  add constraint segments_revisao_completa
    check ((reviewed_at is null) = (reviewed_by is null)),
  add constraint segments_id_canonico unique (id, eh_canonico),
  add constraint segments_alias_um_nivel
    foreign key (canonical_segment_id, aponta_canonico)
    references public.segments (id, eh_canonico);

create index segments_por_canonico
  on public.segments (canonical_segment_id)
  where canonical_segment_id is not null;

create index segments_pendentes_de_revisao
  on public.segments (id)
  where reviewed_at is null;

comment on column public.segments.canonical_segment_id is
  'Quando preenchido, esta linha e ALIAS do segmento apontado. O source_name
   permanece, para a reconciliacao da importacao continuar casando e nunca recriar
   duplicata; elegibilidade e exibicao resolvem pelo canonico. Um nivel so,
   garantido por FK composta — alias nao aponta para alias.';

comment on column public.segments.reviewed_at is
  'Nulo = pendente na fila de normalizacao. Sem esta coluna, segmento que
   legitimamente e `outros` voltaria a fila a cada abertura da tela, e a fila
   deixaria de ser olhada.';

-- ===========================================================================
-- A fila, com o numero que a torna fila de PRIORIDADE
-- ===========================================================================
-- A falha fechada do ADR 0003 faz segmento nao mapeado sumir das modalidades
-- restritas. Quem abre a tela precisa saber QUANTOS estabelecimentos cada
-- pendencia esta escondendo — sem isso e uma lista alfabetica e a ordem de
-- trabalho e arbitraria.
--
-- View, e nao coluna: contagem gravada e estado derivado, e vira mentira
-- silenciosa na primeira importacao que nao a atualize
-- (PLATFORM-STANDARDS.md §4). Com 1.804 estabelecimentos, contar sai de graca.
create view public.segment_normalization_queue as
  select
    s.id,
    s.source_name,
    s.normalized_name,
    s.category,
    s.cnae_hint,
    s.is_active,
    s.canonical_segment_id,
    (select count(*) from public.establishments e
      where e.segment_id = s.id and e.is_active) as establishments_hidden
  from public.segments s
  where s.reviewed_at is null;

comment on view public.segment_normalization_queue is
  'Segmentos pendentes de revisao, com quantos estabelecimentos ativos cada um
   carrega. A ordenacao padrao da tela e por establishments_hidden desc: e o
   numero que transforma a lista em fila de prioridade.';

commit;
