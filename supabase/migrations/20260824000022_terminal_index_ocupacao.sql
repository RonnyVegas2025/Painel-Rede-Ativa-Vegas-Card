-- 0022 Indice do terminal: o conjunto que OCUPA o numero
--
-- A 0020 restringiu a unicidade a `status = 'ativo'`, o que era obvio quando o
-- enum tinha tres valores. Com os seis do complemento §11 a pergunta muda: nao e
-- "qual estado esta em uso", e sim **qual conjunto ocupa o numero do terminal**.
--
--   ocupam    ativo · em_homologacao · com_erro
--   liberam   inativo · substituido · cancelado
--
-- Ponto em homologacao ja tem o numero alocado pelo adquirente, entao um segundo
-- ponto nao pode reivindicar o mesmo. Ponto `com_erro` tambem continua alocado: o
-- problema e do equipamento, nao da alocacao — e e justamente esse estado que a
-- Sprint 7 usa para abrir atendimento. Liberar o numero ali permitiria cadastrar
-- um ponto novo com o mesmo terminal enquanto o atendimento do antigo corre.
--
-- Os tres do segundo grupo liberam: `substituido` e historico de equipamento
-- trocado, `cancelado` e encerramento, `inativo` e desligamento sem substituto.
-- Historico nao pode bloquear o ponto novo.
--
-- CONTINUA PROVISORIO pelo mesmo motivo da 0020: a chave definitiva depende de
-- medicao no arquivo real, que ainda nao chegou. Se o mesmo terminal aparecer em
-- estabelecimentos diferentes, passa a ser (capture_method_id, terminal_number).
-- O recorte de ocupacao acima sobrevive a essa troca — muda a chave, nao o
-- predicado.

begin;

drop index if exists public.establishment_capture_points_terminal_ativo;

create unique index establishment_capture_points_terminal_ocupado
  on public.establishment_capture_points (establishment_id, terminal_number)
  where status in ('ativo', 'em_homologacao', 'com_erro');

comment on index public.establishment_capture_points_terminal_ocupado is
  'PROVISORIO. Unicidade do terminal dentro do estabelecimento, entre os pontos que
   OCUPAM o numero: ativo, em_homologacao e com_erro. Os demais liberam. A chave
   definitiva depende de medicao no arquivo real — ver docs/import-layout.md.';

commit;
