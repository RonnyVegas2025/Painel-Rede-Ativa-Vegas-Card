-- 0032 A composicao do endereco vira funcao propria
--
-- POR QUE
--
-- A 0028 embutiu a composicao dos componentes na expressao da coluna gerada:
--
--   normalize_address(btrim(coalesce(street_name,'') || ' ' ||
--                           coalesce(street_number,'') || ' ' ||
--                           coalesce(district,'')), cep)
--
-- O importador precisa calcular o MESMO hash antes de gravar — e o fallback de
-- identidade do ADR 0001 depende disso: sem contrato, a linha e casada por
-- CNPJ + hash do endereco, e casar exige ter o hash em maos antes do insert.
--
-- Com a composicao embutida na coluna gerada, o lado TypeScript teria de
-- reproduzi-la de memoria. Seria a mesma expressao escrita em dois lugares,
-- livres para divergir — exatamente a classe de defeito que o arnes de paridade
-- existe para eliminar, e que ja apareceu duas vezes neste projeto.
--
-- Extraida como funcao, ela passa a ser comparavel: entra no arnes ao lado de
-- normalize_address, e a gemea TypeScript e verificada a cada CI.
--
-- A coluna gerada e recriada apontando para a funcao. Tabelas vazias, custo zero;
-- depois da primeira importacao isto exigiria recalculo com dados em producao.

begin;

create or replace function public.address_hash_input(
  p_street_name   text,
  p_street_number text,
  p_district      text
)
returns text
language sql
immutable
set search_path = ''
as $$
  -- coalesce, e nao concatenacao direta: componente nulo tornaria a expressao
  -- inteira nula, o hash sumiria em silencio e o registro deixaria de casar
  -- consigo mesmo na importacao seguinte — dando duplicata pelo fallback.
  select btrim(
    coalesce(p_street_name, '') || ' ' ||
    coalesce(p_street_number, '') || ' ' ||
    coalesce(p_district, '')
  );
$$;

comment on function public.address_hash_input is
  'Compoe os componentes do endereco na entrada de normalize_address. Existe como
   funcao, e nao embutida na coluna gerada, para que o importador possa calcular o
   mesmo hash ANTES de gravar — o fallback de identidade do ADR 0001 precisa dele
   para casar a linha — sem reproduzir a expressao de memoria. Gemea de
   addressHashInput em src/lib/business-rules/parse-endereco.ts, comparada pelo
   arnes do ADR 0010.';

alter table public.establishment_addresses
  drop column normalized_address,
  drop column address_hash;

alter table public.establishment_addresses
  add column normalized_address text
    generated always as (
      public.normalize_address(
        public.address_hash_input(street_name, street_number, district),
        cep
      )
    ) stored,
  add column address_hash text
    generated always as (
      md5(
        public.normalize_address(
          public.address_hash_input(street_name, street_number, district),
          cep
        )
      )
    ) stored;

create index establishment_addresses_hash_corrente
  on public.establishment_addresses (address_hash)
  where is_current;

comment on column public.establishment_addresses.normalized_address is
  'Gerada pelo banco sobre os COMPONENTES do endereco, compostos por
   address_hash_input. O rotulo `N.º:` do formulario de origem fica fora: se ele
   mudar, os hashes nao mudam junto. A aplicacao nao grava (ADR 0001).';

revoke execute on function public.address_hash_input(text, text, text) from public;
grant execute on function public.address_hash_input(text, text, text) to authenticated, service_role;

commit;
