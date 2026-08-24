-- 0016 normalize_address: gemea SQL de normalizeAddress (ADR 0001)
--
-- FUNCAO CONGELADA. O hash desta normalizacao e chave persistida. Mudar o
-- comportamento aqui exige migracao de dados: registros gravados com a regra
-- antiga deixam de casar, e a importacao passa a tratar o mesmo ponto credenciado
-- como dois. O arnes de paridade (ADR 0010) compara esta funcao com
-- src/lib/business-rules/normalize-address.ts a cada execucao do CI.
--
-- DUAS DECISOES QUE NAO SAO DETALHE DE IMPLEMENTACAO
--
-- 1. Sem `unaccent`.
--
--    A extensao depende de um arquivo de regras de transliteracao instalado no
--    servidor, que varia entre instalacoes e versoes de imagem. E a mesma classe
--    de dependencia implicita que produziu a ausencia de GRANT na Sprint 0: a
--    mesma migration significando coisas diferentes em maquinas diferentes.
--
--    Hash persistido nao pode depender de arquivo de configuracao do servidor.
--    O mapa de caracteres abaixo e explicito, versionado aqui e determinista.
--
--    O mapa cobre exatamente as letras do Latin-1 que **decompoem** para uma base
--    ASCII mais marca combinante — que e o que o lado TypeScript remove, com
--    `normalize("NFD")` e o intervalo U+0300–U+036F. Letras que nao decompoem
--    (`ø`, `æ`, `ð`, `þ`, `ß`) ficam de fora de proposito: no TypeScript elas
--    sobrevivem ao strip e sao eliminadas depois, ao filtrar `[^a-z0-9\s]`. Aqui
--    acontece o mesmo. Mapea-las produziria divergencia, nao evitaria.
--
-- 2. `\y`, nunca `\b`.
--
--    Em regex POSIX `\b` e **backspace**, nao fronteira de palavra. A traducao
--    literal do `\b` do JavaScript compilaria, rodaria e daria resultado errado
--    sem erro nenhum: `\bal\b` viraria uma busca por backspace-a-l-backspace, que
--    nunca casa, e as abreviacoes simplesmente parariam de expandir. Fronteira de
--    palavra em Postgres e `\y`.
--
-- ORDEM DAS ETAPAS
--
-- Identica a do TypeScript, e a ordem importa:
--   a) caixa baixa e remocao de acento
--   b) `.,;:` viram espaco
--   c) abreviacoes, na ordem do array
--   d) o que sobrar fora de [a-z0-9\s] vira espaco; espacos colapsam; trim
--   e) CEP anexado apenas com 8 digitos
--
-- Consequencia de (b) antes de (c): quando as abreviacoes rodam, ja nao existe
-- ponto no texto. O `\.?` opcional do lado TypeScript e codigo morto — replicado
-- aqui em comentario, e nao em regex, para nao sugerir que faz alguma coisa.

create or replace function public.normalize_address(
  p_raw text,
  p_cep text default null
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
  v_digitos text;
begin
  if p_raw is null then
    return null;
  end if;

  -- (a) Acento e caixa. O translate vem antes do lower e ja mapeia maiuscula
  -- acentuada direto para minuscula sem acento: assim o resultado nao depende de
  -- o `lower()` do servidor saber rebaixar caractere fora do ASCII, que varia com
  -- a collation. Depois do translate, lower() so precisa lidar com A-Z.
  v := lower(
    translate(
      p_raw,
      'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyaaaaaaceeeeiiiinooooouuuuyy'
    )
  );

  -- (b) Pontuacao que separa, antes das abreviacoes.
  v := regexp_replace(v, '[.,;:]', ' ', 'g');

  -- (c) Abreviacoes, na mesma ordem do ABBREVIATIONS do TypeScript. A ordem
  -- importa: `av` vira `avenida` antes de `r` virar `rua`, e nenhuma expansao
  -- pode criar texto que uma regra seguinte casaria por engano.
  v := regexp_replace(v, '\yav\y',            'avenida',     'g');
  v := regexp_replace(v, '\yr\y',             'rua',         'g');
  v := regexp_replace(v, '\ypc\y|\ypca\y',    'praca',       'g');
  v := regexp_replace(v, '\yrod\y',           'rodovia',     'g');
  v := regexp_replace(v, '\yestr\y',          'estrada',     'g');
  v := regexp_replace(v, '\ytrav\y|\ytv\y',   'travessa',    'g');
  v := regexp_replace(v, '\yal\y',            'alameda',     'g');
  v := regexp_replace(v, '\yjd\y',            'jardim',      'g');
  v := regexp_replace(v, '\yvl\y',            'vila',        'g');
  v := regexp_replace(v, '\ypq\y',            'parque',      'g');
  v := regexp_replace(v, '\ys/n\y|\ysn\y',    'sn',          'g');
  v := regexp_replace(v, '\yapto\y|\yap\y',   'apartamento', 'g');

  -- (d) Sobra vira espaco; espaco colapsa; trim.
  v := regexp_replace(v, '[^a-z0-9[:space:]]', ' ', 'g');
  v := regexp_replace(v, '[[:space:]]+',       ' ', 'g');
  v := btrim(v);

  -- (e) CEP entra no hash apenas com 8 digitos.
  v_digitos := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
  if length(v_digitos) = 8 then
    return v || ' ' || v_digitos;
  end if;

  return v;
end;
$$;

comment on function public.normalize_address is
  'Normalizacao de endereco para o hash de identidade do ponto credenciado
   (ADR 0001) e para a deduplicacao da fila de geocodificacao (ADR 0006).
   CONGELADA: o hash e chave persistida. Gemea de normalizeAddress em
   src/lib/business-rules/normalize-address.ts, comparada pelo arnes do ADR 0010.
   Nao usa unaccent de proposito — ver o cabecalho da migration 0016.';

revoke execute on function public.normalize_address(text, text) from public;
grant execute on function public.normalize_address(text, text) to authenticated, service_role;
