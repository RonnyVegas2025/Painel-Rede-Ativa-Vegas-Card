-- 0021 capture_point_status: os tres valores que faltavam
--
-- A 0017 criou o enum com tres valores — `ativo`, `inativo`, `substituido` —
-- alegando que os estados nunca haviam sido declarados. Estavam, em
-- docs/complemento-analise.md linha 242, vindos do complemento de escopo §11:
--
--   capture_point_status | ativo | inativo | em_homologacao | com_erro
--                        | substituido | cancelado
--
-- O erro foi de metodo: verificou-se que o enum nao existia no BANCO, o que era
-- verdade, e disso concluiu-se que nunca fora especificado, o que era falso. Sao
-- coisas diferentes, e a segunda exigia procurar nos documentos.
--
-- POR QUE ISTO NAO PODE ESPERAR
--
-- Adicionar valor a enum e barato agora, com as tabelas vazias. Depois da
-- primeira importacao real deixa de ser: `alter type ... add value` sobre tabela
-- povoada e operacao com dados em producao.
--
-- `com_erro` em particular e o estado que a Sprint 7 usa para abrir atendimento a
-- partir de ponto de captura com problema. Nascer sem ele empurraria uma migration
-- de enum para dentro daquela sprint, com a base ja em uso.
--
-- Os valores entram sozinhos nesta migration. Usa-los no predicado do indice exige
-- outra transacao — o Postgres recusa referenciar valor de enum criado na mesma —,
-- e por isso o indice e refeito na 0022.

alter type public.capture_point_status add value if not exists 'em_homologacao' after 'inativo';
alter type public.capture_point_status add value if not exists 'com_erro'       after 'em_homologacao';
alter type public.capture_point_status add value if not exists 'cancelado'      after 'substituido';

comment on type public.capture_point_status is
  'Estado do ponto de captura, conforme o complemento de escopo §11. Seis valores.
   Dois grupos, e a distincao decide o indice de terminal da 0022: `ativo`,
   `em_homologacao` e `com_erro` OCUPAM o numero do terminal; `inativo`,
   `substituido` e `cancelado` o liberam. Ponto com erro continua alocado — o
   problema e do equipamento, nao da alocacao.';
