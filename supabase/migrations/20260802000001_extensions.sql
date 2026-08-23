-- 0001 Extensoes
-- Extensoes vao em schema proprio, nao em public: manter o namespace limpo evita
-- colisao de nome e deixa o dump mais previsivel.

create schema if not exists extensions;

-- pgcrypto: funcoes de hash. NAO e a origem de gen_random_uuid: desde o PG13 ela
-- vive em pg_catalog, entao qualificar como extensions.gen_random_uuid() falha.
create extension if not exists pgcrypto      with schema extensions;
create extension if not exists citext        with schema extensions;  -- e-mail sem case
create extension if not exists pg_trgm       with schema extensions;  -- busca por nome (Sprint 1)

-- postgis e pg_cron entram na Sprint 2, junto com coordenadas e fila de geocodificacao.
-- Nao habilitar antes: extensao sem uso e superficie de ataque sem contrapartida.

comment on schema extensions is 'Extensoes de terceiros. Fora de public por higiene de namespace.';
