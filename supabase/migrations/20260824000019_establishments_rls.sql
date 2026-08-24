-- 0019 Politicas de RLS das tabelas da Sprint 1
--
-- Mesmas regras da 0009:
--   1. Policy separada por comando. FOR ALL e proibido.
--   2. (select auth.uid()) e nao auth.uid(): initPlan, uma avaliacao por consulta.
--   3. Papel vem de auth_role(), que le o JWT.
--   4. Negacao por padrao: o que nao tem policy, ninguem faz.
--
-- Nenhuma permissao nova. As tres que governam estas tabelas —
-- `estabelecimentos.editar`, `importacao.executar` e `segmentos.editar` — mapeiam,
-- todas, para [gestor_master, administrativo] em src/lib/permissions/matrix.ts,
-- que e exatamente public.is_admin(). Criar um helper novo duplicaria a matriz
-- num segundo lugar, com as duas copias livres para divergir.
--
-- Nenhuma policy de DELETE, pelo mesmo motivo das tabelas anteriores: desativa-se
-- com is_active, e apagar orfanaria a auditoria. Se import_jobs precisar de
-- expurgo por volume, isso e rotina administrativa com politica escrita, nao
-- policy de delete.

begin;

-- ===========================================================================
-- capture_methods · establishments · addresses · capture_points
-- Leitura para todo autenticado; escrita com estabelecimentos.editar.
-- ===========================================================================

create policy "autenticado le meios de captura"
  on public.capture_methods for select to authenticated
  using (true);
create policy "gestao cria meio de captura"
  on public.capture_methods for insert to authenticated
  with check (public.is_admin());
create policy "gestao edita meio de captura"
  on public.capture_methods for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "autenticado le estabelecimentos"
  on public.establishments for select to authenticated
  using (true);
create policy "gestao cria estabelecimento"
  on public.establishments for insert to authenticated
  with check (public.is_admin());
create policy "gestao edita estabelecimento"
  on public.establishments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "autenticado le enderecos"
  on public.establishment_addresses for select to authenticated
  using (true);
create policy "gestao cria endereco"
  on public.establishment_addresses for insert to authenticated
  with check (public.is_admin());
create policy "gestao edita endereco"
  on public.establishment_addresses for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "autenticado le pontos de captura"
  on public.establishment_capture_points for select to authenticated
  using (true);
create policy "gestao cria ponto de captura"
  on public.establishment_capture_points for insert to authenticated
  with check (public.is_admin());
create policy "gestao edita ponto de captura"
  on public.establishment_capture_points for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- import_jobs — leitura E escrita com importacao.executar
-- ===========================================================================
-- Diferente das anteriores: quem nao executa importacao nao le o historico dela.
create policy "gestao le importacoes"
  on public.import_jobs for select to authenticated
  using (public.is_admin());
create policy "gestao cria importacao"
  on public.import_jobs for insert to authenticated
  with check (public.is_admin());
create policy "gestao edita importacao"
  on public.import_jobs for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- import_rows — leitura restrita, escrita apenas pela funcao da importacao
-- ===========================================================================
-- raw_data guarda a linha crua da planilha: telefone, e-mail e razao social de
-- terceiros. Nao e leitura para todo autenticado.
create policy "gestao le linhas da importacao"
  on public.import_rows for select to authenticated
  using (public.is_admin());

-- Sem policy de insert nem de update. A escrita acontece pela funcao da
-- importacao, que roda com privilegio proprio — a linha crua nao e editavel pela
-- interface, do mesmo modo que audit_logs nao e. Corrigir dado importado se faz
-- corrigindo o estabelecimento, com trilha; reescrever a linha crua apagaria a
-- evidencia do que o arquivo trazia.

commit;
