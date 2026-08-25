-- 0039 is_admin() declara a que permissao corresponde
--
-- `is_admin()` = gestor_master + administrativo. Hoje isso coincide exatamente com
-- `importacao.executar`, `configuracoes.editar_operacional` e `bloqueio.aprovar`
-- na matriz de src/lib/permissions/matrix.ts.
--
-- A coincidencia nao esta amarrada em lugar nenhum. Se alguem der
-- `importacao.executar` a `supervisor_rede` na matriz, o SQL continua com dois
-- papeis e a divergencia nao produz erro — produz uma tela que mostra o botao e
-- uma RPC que recusa, ou pior, o contrario.
--
-- Nao ha como amarrar as duas fontes por constraint: a matriz e TypeScript, e
-- espelha-la em tabela criaria a segunda fonte da verdade que este projeto ja
-- pagou caro tres vezes. O que da para fazer e deixar o ponteiro escrito onde
-- quem for mexer vai ler.

comment on function public.is_admin is
  'Papel de gestao: gestor_master ou administrativo.

   Corresponde a `importacao.executar`, `configuracoes.editar_operacional` e
   `bloqueio.aprovar` em docs/permissions.md e src/lib/permissions/matrix.ts.
   A correspondencia NAO e verificada por nenhum teste — nao ha como, com a
   matriz em TypeScript e esta funcao em SQL. Ao mudar qualquer uma das duas,
   mude a outra na mesma alteracao.

   E `security definer` porque le o papel do JWT via auth_role(); nao escreve
   nada e nao exige papel para rodar — exigir papel para checar papel e ciclo.';
