-- 0013 fn_protect_profile_fields: destravar o primeiro gestor master
--
-- PROBLEMA
--
-- A 0004 protege papel, equipe e ativacao com uma unica escapatoria:
--
--   if public.auth_role() = 'gestor_master' then return new; end if;
--
-- auth_role() le request.jwt.claims. Numa conexao direta ao banco — psql, SQL
-- Editor do Studio, migration, seed — nao ha JWT, entao auth_role() devolve
-- 'consulta', que e o default seguro do ADR 0005 e esta certo em si.
--
-- A consequencia nao estava prevista: o passo 5 de docs/setup-validation.md manda
-- rodar, no SQL Editor,
--
--   update public.profiles set role = 'gestor_master' where email = '...';
--
-- e isso falha com "Alteracao de papel exige gestor_master". Trigger nao e RLS:
-- superusuario nao passa por cima. Instalacao nova nasce sem administrador e sem
-- caminho para criar um — trocar papel exige ser gestor master, e ninguem e.
-- Verificado com o banco no ar: as tres linhas do passo 5 falham como postgres.
--
-- DECISAO
--
-- A excecao passa a cobrir tambem a ausencia de contexto PostgREST, que e o que
-- caracteriza acesso direto ao banco.
--
-- Isto NAO afrouxa a protecao; torna-a honesta. Quem tem conexao direta ja podia
-- contornar a trigger em uma linha:
--
--   select set_config('request.jwt.claims', '{"user_role":"gestor_master"}', true);
--
-- ou seja, a barreira nunca protegeu contra acesso direto — apenas travava o
-- procedimento documentado. Pela API a protecao continua identica: o PostgREST
-- sempre popula request.jwt.claims, inclusive em requisicao anonima, entao
-- nenhuma chamada HTTP alcanca esta excecao. service_role tambem continua
-- barrado, porque seu token traz role=service_role e nenhum user_role.
--
-- O caminho de escalada testado na V8 segue fechado: consultor autenticado
-- recebe "Alteracao de papel exige gestor_master".

create or replace function public.fn_protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sem_contexto_http boolean;
begin
  -- Sem claims = conexao direta ao banco (migration, seed, psql, SQL Editor).
  -- Requisicao pela API sempre traz claims, mesmo anonima.
  v_sem_contexto_http :=
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') = '';

  if v_sem_contexto_http or public.auth_role() = 'gestor_master' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Alteracao de papel exige gestor_master';
  end if;
  if new.team_id is distinct from old.team_id then
    raise exception 'Alteracao de equipe exige gestor_master';
  end if;
  if new.is_active is distinct from old.is_active then
    raise exception 'Ativacao e desativacao exigem gestor_master';
  end if;
  return new;
end;
$$;

comment on function public.fn_protect_profile_fields is
  'Impede que papel, equipe e ativacao sejam alterados por quem nao e
   gestor_master. A excecao para conexao sem contexto HTTP existe para o
   bootstrap do primeiro administrador (docs/setup-validation.md passo 5) e nao e
   alcancavel pela API: o PostgREST sempre popula request.jwt.claims.';
