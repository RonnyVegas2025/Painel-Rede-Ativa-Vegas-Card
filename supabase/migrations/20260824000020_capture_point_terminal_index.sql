-- 0020 Unicidade do terminal — PROVISORIA
--
-- Migration propria, com um indice so, de proposito. A chave correta depende de
-- medicao no arquivo real, que ainda nao chegou. Quando chegar, substituir vira
-- um arquivo revertido e outro criado, em vez de editar uma migration que tambem
-- cria tabela.
--
-- O QUE AINDA NAO SE SABE
--
-- Numero de terminal e atribuido pelo adquirente, entao a expectativa — a
-- confirmar, nao a assumir — e que a unicidade seja **por meio de captura**, nem
-- global nem por estabelecimento. Se o arquivo mostrar o mesmo terminal em
-- estabelecimentos diferentes, a chave passa a ser
-- (capture_method_id, terminal_number) e esta migration e revertida.
--
-- Medicoes que decidem, listadas em docs/import-layout.md:
--   quantos Terminal distintos;
--   quantos repetem entre estabelecimentos diferentes;
--   quantos estabelecimentos tem mais de um.
--
-- POR QUE PARCIAL
--
-- capture_point_status inclui `substituido`. Um estabelecimento que trocou de
-- equipamento tem legitimamente o ponto antigo e o novo convivendo, e unicidade
-- cega sobre (establishment_id, terminal_number) rejeitaria a linha historica.
-- Ponto historico nao pode bloquear o ponto novo, entao a restricao vale apenas
-- sobre o que esta em operacao.
--
-- ENQUANTO A MEDICAO NAO EXISTE
--
-- O importador registra colisao de terminal como **conflito**, em import_rows,
-- nunca como rejeicao da linha. Rejeitar por uma regra ainda nao verificada perde
-- dado real, e dado perdido na importacao nao volta.

create unique index establishment_capture_points_terminal_ativo
  on public.establishment_capture_points (establishment_id, terminal_number)
  where status = 'ativo';

comment on index public.establishment_capture_points_terminal_ativo is
  'PROVISORIO. Unicidade do terminal dentro do estabelecimento, apenas entre
   pontos ativos — ponto substituido permanece como historico e nao bloqueia o
   novo. A chave definitiva depende de medicao no arquivo real: se o mesmo
   terminal aparecer em estabelecimentos diferentes, passa a ser
   (capture_method_id, terminal_number). Ver migration 0020 e
   docs/import-layout.md.';
