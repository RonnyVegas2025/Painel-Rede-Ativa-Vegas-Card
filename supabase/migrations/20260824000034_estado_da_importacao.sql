-- 0034 Estado da importacao, ausentes e o relatorio de qualidade da origem
--
-- ===========================================================================
-- 1. Estado: o que torna o commit idempotente contra repeticao
-- ===========================================================================
-- Botao de confirmar clicado duas vezes, ou requisicao que caiu depois de gravar,
-- nao podem importar duas vezes.
--
-- Nao precisa de mecanismo novo. O commit so procede se o job estiver em
-- `previa`, muda para `aplicando` na MESMA transacao — o que serializa a segunda
-- chamada — e termina em `concluida`. A segunda encontra estado diferente e
-- devolve o resultado anterior em vez de reprocessar.
--
-- Mesmo principio do client_operation_id do ADR 0007, com a vantagem de o estado
-- ja pertencer ao modelo em vez de ser um identificador carregado pelo cliente.
create type public.import_job_status as enum (
  'previa',      -- classificada, nada aplicado ao dominio
  'aplicando',   -- commit em curso; estado transitorio dentro da transacao
  'concluida',
  'cancelada',
  'falhou'
);

alter table public.import_jobs
  add column status public.import_job_status not null default 'previa',
  -- Quantas linhas traziam o mesmo meio de captura repetido. Defeito da ORIGEM,
  -- nao conflito: nao bloqueia nada, e deduplicar em silencio faria o dado errado
  -- voltar em toda importacao sem ninguem notar. Sao 9 na base atual.
  add column duplicated_capture_methods integer not null default 0,
  -- Enderecos com `N.º: 0`. O fallback de identidade fica fraco neles.
  add column addresses_without_number integer not null default 0,
  add column error_message text;

comment on column public.import_jobs.status is
  'Ciclo de vida. O commit exige `previa` e muda para `aplicando` na mesma
   transacao: e o que impede que confirmar duas vezes importe duas vezes.';
comment on column public.import_jobs.duplicated_capture_methods is
  'Linhas cujo campo Terminal repetia o mesmo meio — `CIELO / CIELO`. Deduplicado
   na aplicacao, porque a identidade de um ponto e (estabelecimento, meio) e
   inserir os dois violaria o indice unico. Contado aqui porque e defeito da
   origem, e silenciar faria voltar em toda importacao.';

-- ===========================================================================
-- 2. Ausente: marcado, nunca apagado, e sempre dentro do escopo
-- ===========================================================================
-- Registro presente na base e ausente do arquivo vai para analise administrativa
-- (ADR 0011). A marcacao guarda QUANDO e POR QUAL importacao — sem isso, a
-- pergunta "desde quando este ponto sumiu" nao tem resposta.
--
-- Nao ha coluna de "voltou": reaparecer no arquivo seguinte simplesmente limpa a
-- marcacao, e a trilha de auditoria registra as duas transicoes. Guardar historico
-- de ausencia numa coluna seria inventar uma tabela de historico pela metade.
alter table public.establishments
  add column absent_since timestamptz,
  add column absent_from_import uuid references public.import_jobs(id);

create index establishments_ausentes
  on public.establishments (absent_since)
  where absent_since is not null;

comment on column public.establishments.absent_since is
  'Desde quando o registro deixou de vir no arquivo, DENTRO do escopo declarado
   da importacao (ADR 0011). Nunca excluido: vai para analise administrativa.
   Reaparecer limpa a marcacao, e a trilha registra as duas transicoes.';

-- ===========================================================================
-- 3. O limiar de ausentes vive em system_settings, nunca no codigo
-- ===========================================================================
-- Quem opera a base sabe melhor que o desenvolvedor qual variacao e normal.
insert into public.system_settings
  (key, value, value_type, unit, min_value, max_value, description, min_role)
values (
  'import_missing_threshold_percent',
  '20'::jsonb,
  'integer',
  'por cento',
  1,
  100,
  'Percentual de ausentes que faz a importacao parar e exigir confirmacao explicita. O desastre classico e exportar a planilha com um filtro aplicado e a base inteira aparecer como sumida — nada seria excluido, mas uma fila administrativa com 1.400 itens e indistinguivel de ruido.',
  'administrativo'
)
on conflict (key) do nothing;
