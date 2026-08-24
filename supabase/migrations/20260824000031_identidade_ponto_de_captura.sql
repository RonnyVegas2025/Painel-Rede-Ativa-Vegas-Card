-- 0031 A identidade de um ponto de captura, e o que acontece quando ele some
--
-- ===========================================================================
-- 1. A chave de reconciliacao
-- ===========================================================================
-- `terminal_number` e nulo em 100% das linhas da base, e `is_primary` tambem.
-- Logo a identidade de uma linha de establishment_capture_points e
-- **(establishment_id, capture_method_id)**, e so ela.
--
-- Sem isto explicito, a segunda importacao insere de novo as 3.586 linhas em vez
-- de reconhece-las. E o tipo de defeito que nao aparece na segunda importacao —
-- aparece na terceira ou na quarta, quando alguem repara que o numero dobrou e
-- ja nao da para saber quais linhas eram as originais.
--
-- O indice e parcial sobre capture_method_id nao nulo porque a FK e anulavel: um
-- ponto cujo meio ainda nao foi reconciliado nao tem identidade para conflitar, e
-- forcar unicidade ali impediria mais de um ponto pendente no mesmo
-- estabelecimento.
create unique index establishment_capture_points_identidade
  on public.establishment_capture_points (establishment_id, capture_method_id)
  where capture_method_id is not null;

comment on index public.establishment_capture_points_identidade is
  'Chave de reconciliacao da importacao. Com terminal_number nulo em toda a base,
   a identidade de um ponto e o par estabelecimento x meio de captura. O
   importador faz upsert por este par; sem ele, cada importacao duplicaria as
   3.586 linhas.';

-- ===========================================================================
-- 2. Meio de captura que sumiu nao e linha apagada
-- ===========================================================================
-- Mesmo principio do estabelecimento ausente: se a proxima planilha trouxer dois
-- meios onde antes havia tres, o terceiro NAO e excluido. Vai para `inativo`,
-- com a data, e aparece no relatorio.
--
-- Nao e conservadorismo: comercio que trocou de adquirente e informacao
-- operacional, e e exatamente o que a Sprint 7 vai querer olhar ao abrir
-- atendimento sobre falha de captura. Apagar destruiria a unica evidencia de que
-- a troca aconteceu.
alter table public.establishment_capture_points
  add column inactivated_at timestamptz,
  add column inactivated_by_import uuid references public.import_jobs(id),
  -- Data de inativacao so faz sentido em ponto inativo. A recíproca NAO vale:
  -- ponto pode ser `inativo` sem data, porque a inativacao tambem acontece por
  -- decisao manual, e nem toda decisao manual passa por importacao.
  add constraint establishment_capture_points_inativacao_coerente
    check (inactivated_at is null or status = 'inativo');

comment on column public.establishment_capture_points.inactivated_at is
  'Quando o meio deixou de aparecer na planilha. Linha nunca e apagada: um
   comercio que trocou de adquirente e o que a Sprint 7 olha ao abrir atendimento
   sobre falha de captura.';
comment on column public.establishment_capture_points.inactivated_by_import is
  'Qual importacao constatou a ausencia. Liga a inativacao ao arquivo que a
   causou, para a duvida "por que este meio sumiu" ter resposta.';

-- ===========================================================================
-- 3. `Consultores` fica como texto cru
-- ===========================================================================
-- 28 valores, e o mais frequente — `Vegas Card do Brasil`, em 808 das 1.804
-- linhas — e a EMPRESA, nao uma pessoa. Os demais sao nomes soltos que podem ou
-- nao corresponder a alguem em profiles.
--
-- Casar nome de pessoa automaticamente e fonte classica de atribuicao errada, e
-- aqui a atribuicao decide quem visita o que. O valor cru fica guardado; o
-- vinculo com profiles, se for necessario, vira fila de conciliacao como a de
-- segmentos — na Sprint 3, quando acoes e equipes existirem e alguem puder
-- confirmar caso a caso.
alter table public.establishments
  add column assigned_consultants_raw text;

comment on column public.establishments.assigned_consultants_raw is
  'Coluna `Consultores` da planilha, crua e sem interpretacao. NAO vincular a
   profiles automaticamente: o valor mais frequente e o nome da empresa, e casar
   nome de pessoa por aproximacao erra atribuicao — que aqui decide quem visita o
   que. Conciliacao explicita na Sprint 3.';
