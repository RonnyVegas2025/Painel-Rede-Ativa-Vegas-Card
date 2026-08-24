-- 0017 Enums da Sprint 1
--
-- capture_point_status NAO existia. A Sprint 0 criou dez enums e ele nao estava
-- entre eles — o complemento de analise descreve a tabela filha, mas nunca
-- declarou os estados. Fica declarado aqui.
--
-- `substituido` e o estado que justifica o indice de terminal ser parcial: um
-- estabelecimento que trocou de equipamento tem legitimamente o ponto antigo e o
-- novo convivendo, e unicidade cega sobre (establishment_id, terminal_number)
-- rejeitaria a linha historica. Ponto historico nao pode bloquear o ponto novo.
--
-- import_row_status espelha, valor a valor, o tipo ImportRowStatus de
-- src/types/import.ts. Divergir aqui faria o tipo do TypeScript mentir sobre o
-- que o banco aceita.

create type public.capture_point_status as enum (
  'ativo',        -- em operacao
  'inativo',      -- desligado, sem substituto
  'substituido'   -- trocado por outro ponto; permanece como historico
);

create type public.import_row_status as enum (
  'novo',
  'atualizado',
  'inalterado',
  'conflito',
  'erro',
  'ausente'       -- presente na base, ausente do arquivo. NUNCA excluido.
);

comment on type public.capture_point_status is
  'Estado do ponto de captura. `substituido` preserva o historico do equipamento
   trocado, e por isso a unicidade de terminal e parcial sobre os ativos.';

comment on type public.import_row_status is
  'Classificacao da linha na importacao. Espelha ImportRowStatus em
   src/types/import.ts. `ausente` marca registro que sumiu do arquivo: vai para
   analise administrativa, nunca para exclusao.';
