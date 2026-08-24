-- 0027 Ajustes que a base real exigiu
--
-- Tres achados da medicao de `Base de Comericos SP.xlsx` mudam schema, e por isso
-- entram antes do importador existir.
--
-- ===========================================================================
-- B.1 — `Terminal` nao e numero de terminal
-- ===========================================================================
-- A medicao pendente nao tem resposta porque a pergunta estava errada: NAO HA
-- numero de terminal na base. Zero dos 1.804 valores contem digito.
--
-- A coluna traz nomes de adquirente e gateway separados por ` / `:
--
--   Software Express Sitef / Software Express CARD SE / Resomaq
--   Conductor Scope / CIELO
--
-- 73 combinacoes; separadas, treze meios distintos — Software Express Sitef
-- (1.151), Resomaq (810), Software Express CARD SE (517), CIELO (505), Rede,
-- Conductor Scope, Getnet, Linx, POS Web, PagSeguro, FIRST, Safrapay, Stone.
--
-- Meios por estabelecimento: 765 com um, 338 com dois, 661 com tres, 38 com
-- quatro, 2 com cinco. Cerca de 3.600 linhas em establishment_capture_points.
--
-- Consequencias:
--   `terminal_number` fica nulo em 100% das linhas, entao deixa de ser not null
--   e o indice unico provisorio sai — nao ha o que indexar.
--   `is_primary` nao e derivavel: inventar primario pela ordem de uma string e
--   dado fabricado. Fica nulo para todos. O indice unico parcial continua
--   correto e simplesmente nao dispara.
--
-- ===========================================================================
-- B.2 — `Captacao` nao e meio de captura
-- ===========================================================================
-- A instrucao anterior mandava semear capture_methods a partir de `Captacao`.
-- Os valores sao `Pessoalmente` (1.477), `E-Mail` (260), `Telefone` (59),
-- `Site` (7), `Licitacao` (1): e como o comercio foi CREDENCIADO, nao como ele
-- captura transacao.
--
-- `Captacao` vira `establishments.acquisition_channel`. capture_methods passa a
-- ser semeada a partir de `Terminal`, separando por `/`.
--
-- ===========================================================================
-- B.3 — `Endereco` tem estrutura fixa
-- ===========================================================================
-- Padrao `Logradouro - N.º: X - Bairro` em 1.804 de 1.804:
--
--   Rua Harmonia - N.º: 373 - Sumarezinho
--
-- Hoje normalize_address recebe a string inteira e o literal `N.º:` entra no hash
-- de TODAS as linhas. Funciona, mas e ruido constante — e qualquer variacao futura
-- daquele rotulo mudaria todos os hashes de uma vez, o que num hash persistido
-- significa migracao de dados.
--
-- O parse acontece no importador; aqui entram as colunas. `street` continua
-- guardando a string bruta, intocada. O hash passa a ser sobre os componentes.
--
-- 61 enderecos tem `N.º: 0` — sem numero. Para eles o fallback CNPJ + endereco
-- fica fraco, e a previa sinaliza.

begin;

-- --- B.1 ---------------------------------------------------------------------
drop index if exists public.establishment_capture_points_terminal_ocupado;

alter table public.establishment_capture_points
  alter column terminal_number drop not null,
  alter column is_primary drop not null,
  alter column is_primary drop default;

comment on column public.establishment_capture_points.terminal_number is
  'Numero do terminal. NULO em toda a base atual: a coluna `Terminal` da planilha
   traz nome de adquirente e gateway, nunca numero — zero valores com digito. Fica
   para quando houver origem que traga o numero de fato.';

comment on column public.establishment_capture_points.is_primary is
  'Nulo enquanto nao houver origem que diga qual e o principal. Deduzir da ordem
   em que os meios aparecem numa string seria dado fabricado. O indice unico
   parcial continua valendo e simplesmente nao dispara com nulo.';

-- --- B.2 ---------------------------------------------------------------------
alter table public.establishments
  add column acquisition_channel text;

comment on column public.establishments.acquisition_channel is
  'Coluna `Captacao` da planilha: como o comercio foi credenciado — Pessoalmente,
   E-Mail, Telefone, Site, Licitacao. Nao confundir com meio de captura de
   transacao, que e capture_methods e vem da coluna `Terminal`.';

-- --- B.3 ---------------------------------------------------------------------
alter table public.establishment_addresses
  add column street_name   text,
  add column street_number  text,
  add column district       text;

comment on column public.establishment_addresses.street is
  'Endereco bruto da planilha, preservado intocado — inclusive o rotulo `N.º:` do
   formulario de origem. Os componentes parseados vivem nas colunas ao lado.';
comment on column public.establishment_addresses.street_name is
  'Logradouro, extraido do padrao `Logradouro - N.º: X - Bairro`.';
comment on column public.establishment_addresses.street_number is
  'Numero. `0` na origem significa sem numero: 61 casos na base, em que o
   fallback de identidade CNPJ + endereco fica fraco e a previa sinaliza.';
comment on column public.establishment_addresses.district is
  'Bairro, extraido do mesmo padrao.';

commit;
