-- 0045 Os indices que a listagem pressupoe
--
-- O QUE ACONTECEU
--
-- O servico da listagem foi escrito convertendo o status transacional num
-- intervalo de datas — em vez de calcular o status de cada linha e descartar o
-- resto — com o comentario dizendo que `last_transaction_at` E INDEXADO.
--
-- Nao era. Nenhum indice existia sobre ele.
--
-- O raciocinio estava certo e a premissa era falsa: `calculate_transaction_status`
-- e `STABLE` e le `system_settings`, entao de fato nao e indexavel, e comparar a
-- data e de fato a forma certa. Mas sem indice as duas formas fazem varredura
-- completa, e a otimizacao existia so no comentario.
--
-- E a mesma classe de erro desta sprint inteira, agora do meu lado: descrever uma
-- suposicao como se fosse garantia. Encontrado ao MEDIR, nao ao reler.
--
-- ===========================================================================
-- 1. Recencia
-- ===========================================================================
-- `desc nulls last` espelha a ordenacao padrao da tela. Parcial em `is_active`
-- porque toda consulta da listagem filtra por ele — registro inativo nao aparece
-- em lista nenhuma, e mante-lo fora do indice reduz o que precisa ser lido.
create index establishments_recencia
  on public.establishments (last_transaction_at desc nulls last)
  where is_active;

comment on index public.establishments_recencia is
  'Sustenta o filtro e a ordenacao por recencia. A tela converte o status
   transacional num intervalo de datas (intervalo-de-recencia.ts) exatamente para
   poder usar este indice: calculate_transaction_status e STABLE e le
   system_settings, entao nao e indexavel.';

-- Quem nunca transacionou e uma condicao SEPARADA, nao um nulo (ADR 0009). Sao
-- 319 linhas de 1.804 na base atual — parcial, porque so o `true` e consultado.
create index establishments_nunca_transacionou
  on public.establishments (id)
  where is_active and never_transacted;

-- ===========================================================================
-- 2. As outras dimensoes da listagem
-- ===========================================================================
create index establishments_operacional
  on public.establishments (operational_status)
  where is_active;

create index establishments_cadastral
  on public.establishments (registration_status)
  where is_active;

create index establishments_segmento
  on public.establishments (segment_id)
  where is_active and segment_id is not null;

-- Cidade do endereco CORRENTE: o filtro de cidade e o `join` da listagem passam
-- os dois por aqui.
create index establishment_addresses_cidade_corrente
  on public.establishment_addresses (city)
  where is_current;

-- ===========================================================================
-- 3. O QUE ESTE ARQUIVO NAO RESOLVE
-- ===========================================================================
-- A busca por nome usa `ilike '%termo%'`. Nenhum btree serve para isso: o coringa
-- a esquerda impede o uso do indice, e a consulta varre a tabela.
--
-- Com 1.804 linhas isso e irrelevante — a varredura custa menos que a viagem ate o
-- banco. Com 20 mil comeca a doer.
--
-- A correcao seria `pg_trgm` com indice GIN. NAO entra aqui: instalar extensao e
-- decisao registrada (CLAUDE.md), e ela tem custo de escrita em cada importacao —
-- 7.200 linhas por vez. A medicao que justifica a decisao ainda nao existe, e
-- otimizar sem medir e como o comentario que originou esta migration.
--
-- Fica anotado onde alguem vai procurar quando a busca ficar lenta.
