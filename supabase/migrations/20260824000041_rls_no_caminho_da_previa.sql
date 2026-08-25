-- 0041 A previa escreve com a RLS ligada — service_role fora do caminho
--
-- O FURO QUE O DESENHO ESTAVA EMPURRANDO
--
-- Quem le o arquivo do Storage, faz o parse e insere as 1.804 linhas e codigo
-- Node: o Postgres nao le Storage. O caminho obvio seria o cliente `service_role`,
-- que IGNORA A RLS POR COMPLETO — e ai a checagem de papel da RPC de criacao nao
-- protegeria a insercao. Seria o furo do import_commit um andar acima, no caminho
-- paralelo.
--
-- E o desenho empurrava para la: `import_rows` tinha policy de SELECT e nenhuma
-- de INSERT. Inserir SO era possivel com service_role. A ausencia de policy nao
-- era restricao — era um convite, porque a tarefa precisa ser feita de algum
-- jeito e so sobrava o jeito que ignora a RLS.
--
-- `src/lib/supabase/admin.ts` ainda diz "uso restrito a worker e importacao no
-- servidor". Com estas policies, a importacao sai dessa lista: ela escreve com o
-- cliente do USUARIO, e a RLS volta a ser a fronteira real.

begin;

create policy "gestao cria linhas da importacao"
  on public.import_rows for insert
  to authenticated
  with check (public.is_admin());

-- POR QUE NAO HA POLICY DE DELETE AQUI
--
-- O primeiro desenho tinha uma: descartar a previa apagaria as linhas. Duas
-- assercoes de 06_establishments.sql barraram — "import_rows nao tem policy de
-- escrita" e "nenhuma tabela da Sprint 1 tem policy de delete" — e elas estavam
-- certas, nao no caminho.
--
-- Descartar e mudar o ESTADO do job para `cancelada`, com motivo. As linhas
-- ficam: sao o registro do que alguem tentou importar, e e justamente isso que se
-- quer olhar depois quando a tentativa foi estranha. Apagar tornaria o descarte
-- invisivel — o oposto de "descarte auditado".
--
-- A assercao de escrita foi REFINADA, nao afrouxada: `import_rows` aceita INSERT
-- de gestao e mais nada. "Evidencia" quer dizer imutavel depois de escrita, o que
-- e sobre UPDATE e DELETE. Alguem precisa escrever a primeira vez, e antes disto
-- so `service_role` podia — que e o furo.

commit;
