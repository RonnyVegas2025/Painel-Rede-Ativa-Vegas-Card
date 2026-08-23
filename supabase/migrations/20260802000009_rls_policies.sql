-- 0009 Politicas de RLS
--
-- Regras que valem para todas:
--   1. Policy separada por comando. FOR ALL e proibido: obriga a pensar em delete.
--   2. (select auth.uid()) e nao auth.uid(). O planejador trata como initPlan e avalia
--      uma vez por consulta em vez de uma vez por linha.
--   3. Papel vem de auth_role(), que le o JWT. Nunca consultar profiles em policy de profiles.
--   4. Negacao por padrao: o que nao tem policy, ninguem faz.

-- ===========================================================================
-- profiles
-- ===========================================================================
create policy "usuario le o proprio perfil"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "gestao le todos os perfis"
  on public.profiles for select to authenticated
  using (public.has_role('gestor_master','administrativo','suporte_tecnico'));

create policy "supervisor le a propria equipe"
  on public.profiles for select to authenticated
  using (
    public.auth_role() = 'supervisor_rede'
    and team_id is not null
    and team_id = public.auth_team_id()
  );

create policy "usuario edita o proprio perfil"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "gestor master edita perfis"
  on public.profiles for update to authenticated
  using (public.auth_role() = 'gestor_master')
  with check (public.auth_role() = 'gestor_master');

-- Sem policy de insert: perfil nasce do trigger em auth.users.
-- Sem policy de delete: desativa-se com is_active. Apagar perfil orfanaria auditoria.

-- O usuario nao pode promover a si mesmo. A policy de update acima nao consegue
-- distinguir qual coluna mudou, entao a trava e por trigger.
create or replace function public.fn_protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() = 'gestor_master' then
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

create trigger profiles_protect before update on public.profiles
  for each row execute function public.fn_protect_profile_fields();

create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.fn_audit();

-- ===========================================================================
-- teams
-- ===========================================================================
create policy "autenticado le equipes"
  on public.teams for select to authenticated using (true);

create policy "gestor master cria equipe"
  on public.teams for insert to authenticated
  with check (public.auth_role() = 'gestor_master');

create policy "gestor master edita equipe"
  on public.teams for update to authenticated
  using (public.auth_role() = 'gestor_master')
  with check (public.auth_role() = 'gestor_master');

create trigger teams_audit after insert or update or delete on public.teams
  for each row execute function public.fn_audit();

-- ===========================================================================
-- Catalogo: leitura para todo autenticado, escrita para gestao
-- ===========================================================================
create policy "autenticado le modalidades"
  on public.card_products for select to authenticated using (true);
create policy "gestao cria modalidade"
  on public.card_products for insert to authenticated with check (public.is_admin());
create policy "gestao edita modalidade"
  on public.card_products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Sem delete: modalidade sai de operacao com is_active = false. Apagar quebraria
-- historico de acoes e visitas.

create policy "autenticado le segmentos"
  on public.segments for select to authenticated using (true);
create policy "gestao cria segmento"
  on public.segments for insert to authenticated with check (public.is_admin());
create policy "gestao edita segmento"
  on public.segments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "autenticado le elegibilidade"
  on public.product_segments for select to authenticated using (true);
create policy "gestao cria elegibilidade"
  on public.product_segments for insert to authenticated with check (public.is_admin());
create policy "gestao edita elegibilidade"
  on public.product_segments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "gestao remove elegibilidade"
  on public.product_segments for delete to authenticated using (public.is_admin());
-- Delete existe aqui e so aqui: a linha e a regra, e revogar a regra e operacao
-- legitima do dia a dia. Fica auditada.

-- ===========================================================================
-- system_settings: leitura geral, escrita conforme min_role da chave
-- ===========================================================================
create policy "autenticado le parametros"
  on public.system_settings for select to authenticated using (true);

create policy "alteracao conforme min_role da chave"
  on public.system_settings for update to authenticated
  using (
    case min_role
      when 'gestor_master'  then public.auth_role() = 'gestor_master'
      when 'administrativo' then public.is_admin()
      else false
    end
  )
  with check (
    case min_role
      when 'gestor_master'  then public.auth_role() = 'gestor_master'
      when 'administrativo' then public.is_admin()
      else false
    end
  );

-- Sem insert e sem delete: o conjunto de parametros e definido por migration.
-- Chave nova exige deploy, e isso e proposital: parametro sem codigo que o leia
-- e configuracao morta.

-- ===========================================================================
-- audit_logs: leitura restrita, escrita nunca
-- ===========================================================================
create policy "gestao le auditoria"
  on public.audit_logs for select to authenticated
  using (public.has_role('gestor_master','administrativo'));

-- Sem insert (so via fn_audit, que e SECURITY DEFINER).
-- Sem update. Sem delete. Para ninguem, nem gestor_master.
