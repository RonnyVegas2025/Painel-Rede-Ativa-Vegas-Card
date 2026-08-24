-- 0025 A view da fila nao pode ser porta de entrada
--
-- DEFEITO INTRODUZIDO PELA 0023, ENCONTRADO PELO CAMINHO REAL
--
-- `segment_normalization_queue` nasceu com dois problemas, e os dois so aparecem
-- fora do pgTAP, que roda como postgres e nao exercita RLS:
--
-- 1. **A view ignorava a RLS.** Sem `security_invoker`, uma view roda com o
--    privilegio de quem a criou. As policies de `segments` e `establishments`
--    simplesmente nao eram avaliadas para quem consultasse pela view.
--
-- 2. **A view aceitava escrita.** Ela e auto-atualizavel — um `from` unico, sem
--    agregacao no nivel de cima —, e o privilegio padrao do schema (0014/0015)
--    concede DML a `authenticated` em toda relacao nova, view inclusive.
--
--    Resultado verificado com token de consultor_campo: um `POST` para
--    `/rest/v1/segment_normalization_queue` inseriu uma linha em `public.segments`,
--    contornando a policy "gestao cria segmento". Escalada de privilegio por uma
--    view de leitura.
--
-- POR QUE OS TESTES NAO PEGARAM
--
-- `05_grants_and_rls.sql` varre `pg_class` com `relkind = 'r'` — apenas tabelas.
-- A varredura era generica quanto a QUAIS tabelas, e cega quanto a relacoes que
-- nao sao tabelas. Foi a primeira view do schema que expos isso. O arquivo passa
-- a cobrir `relkind = 'v'` tambem.
--
-- CORRECAO
--
-- `security_invoker = true` faz a view avaliar as policies de quem consulta, que
-- e o unico comportamento defensavel para uma view sobre tabela com RLS.
--
-- E o privilegio de escrita e revogado explicitamente. Nao basta nao conceder: o
-- privilegio padrao concede sozinho, e toda view futura nascera assim. Por isso a
-- verificacao no pgTAP, e nao so o revoke aqui.

begin;

alter view public.segment_normalization_queue set (security_invoker = true);

revoke insert, update, delete on public.segment_normalization_queue
  from authenticated, service_role, anon;

comment on view public.segment_normalization_queue is
  'Segmentos pendentes de revisao, com quantos estabelecimentos ativos cada um
   carrega. Ordenacao padrao da tela: establishments_hidden desc — e o numero que
   transforma a lista em fila de prioridade.

   Somente leitura, e com security_invoker: view sobre tabela com RLS que nao
   avalia as policies de quem consulta e um vazamento, e view auto-atualizavel com
   privilegio de escrita e uma porta para contornar a policy da tabela de baixo.';

commit;
