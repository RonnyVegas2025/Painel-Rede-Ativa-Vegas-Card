-- 0028 O hash passa a ser sobre os componentes do endereco
--
-- POR QUE MUDAR AGORA, E SO AGORA
--
-- `Endereco` tem estrutura fixa em 1.804 de 1.804 linhas:
--
--   Rua Harmonia - N.º: 373 - Sumarezinho
--
-- Com o hash sobre a string inteira, o literal `N.º:` entra no hash de todas as
-- linhas. Funciona — e ruido constante, e ruido constante nao quebra nada. O
-- problema e outro: **se aquele rotulo mudar na origem, todos os hashes mudam de
-- uma vez**, e hash e chave de identidade persistida. Um dia em que a exportacao
-- passe a escrever `Nº:` sem ponto reidentificaria a base inteira.
--
-- Esta e a ultima janela em que a mudanca e gratuita: as tabelas estao vazias.
-- Depois da primeira importacao, mudar a expressao de uma coluna gerada exige
-- recalculo com dados em producao — exatamente o que o ADR 0001 adverte.
--
-- O QUE NAO MUDA
--
-- `public.normalize_address` continua identica, congelada e no arnes de paridade.
-- O que muda e o que ela recebe: os componentes em vez da string com o rotulo do
-- formulario de origem. A funcao nao sabe da diferenca, e a gemea TypeScript
-- tambem nao precisa saber — quem monta a entrada e o importador, dos dois lados.
--
-- `street` continua guardando a string bruta, intocada. O endereco original
-- importado e preservado sempre (ADR 0006).
--
-- COALESCE, E POR QUE
--
-- Se o parse falhar, os componentes vem nulos. Concatenacao com nulo devolve
-- nulo, e o hash sumiria em silencio — o registro deixaria de casar consigo mesmo
-- na importacao seguinte, e o fallback de identidade daria duplicata. Com
-- coalesce, componente ausente vira string vazia e o hash continua determinado
-- pelo que existe.

begin;

-- Coluna gerada nao aceita `alter ... set expression`: precisa sair e voltar. As
-- tabelas estao vazias, entao nao ha recalculo a fazer.
alter table public.establishment_addresses
  drop column normalized_address,
  drop column address_hash;

alter table public.establishment_addresses
  add column normalized_address text
    generated always as (
      public.normalize_address(
        btrim(
          coalesce(street_name, '') || ' ' ||
          coalesce(street_number, '') || ' ' ||
          coalesce(district, '')
        ),
        cep
      )
    ) stored,
  add column address_hash text
    generated always as (
      md5(
        public.normalize_address(
          btrim(
            coalesce(street_name, '') || ' ' ||
            coalesce(street_number, '') || ' ' ||
            coalesce(district, '')
          ),
          cep
        )
      )
    ) stored;

-- O indice do fallback do ADR 0001 caiu junto com a coluna.
create index establishment_addresses_hash_corrente
  on public.establishment_addresses (address_hash)
  where is_current;

comment on column public.establishment_addresses.normalized_address is
  'Gerada pelo banco por public.normalize_address, sobre os COMPONENTES do
   endereco — logradouro, numero e bairro — e nao sobre a string bruta. O rotulo
   `N.º:` do formulario de origem fica fora: se ele mudar, os hashes nao mudam
   junto. A aplicacao nao grava; ver ADR 0001.';

commit;
