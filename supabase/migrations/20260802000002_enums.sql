-- 0002 Enums
-- Cinco dimensoes de status independentes (CLAUDE.md secao 6, docs/status-flows.md).
-- Enum e usado onde o valor dirige logica e muda raramente. Onde o valor e
-- configuravel pelo administrativo, usa-se tabela de dominio.

create type public.user_role as enum (
  'gestor_master', 'administrativo', 'supervisor_rede',
  'consultor_campo', 'suporte_tecnico', 'comercial', 'consulta'
);

create type public.eligibility_mode as enum ('all', 'allowlist', 'denylist');
create type public.segment_rule_type as enum ('allow', 'deny');

create type public.registration_status as enum ('ativo', 'bloqueado', 'cancelado', 'em_analise');

create type public.transaction_status as enum (
  'recente', 'atencao', 'acao_necessaria', 'critico', 'nunca_transacionou'
);

create type public.operational_status as enum (
  'apto', 'problema_tecnico', 'fechado_temporariamente', 'encerrado',
  'mudanca_proprietario', 'mudanca_endereco', 'equipamento_indisponivel',
  'bloqueio_solicitado', 'suspenso', 'em_reativacao'
);

-- ATENCAO: 'disponivel' NAO existe aqui, e a ausencia e proposital (ADR 0002).
-- Disponivel e a ausencia de visita ativa, derivada em consulta. Se fosse valor do
-- enum, alguem gravaria uma linha com esse status; ela nao seria pega pelo indice
-- de exclusividade nem pela expiracao, e travaria o estabelecimento em silencio.
create type public.visit_status as enum (
  'reservada', 'em_deslocamento', 'checkin_realizado', 'em_atendimento',
  'concluida', 'cancelada', 'expirada'
);

create type public.occurrence_status as enum (
  'aberta', 'em_analise', 'aguardando_informacao',
  'aprovada', 'rejeitada', 'resolvida', 'cancelada'
);

create type public.audit_action as enum ('insert', 'update', 'delete', 'login', 'custom');
create type public.audit_origin as enum ('web', 'import', 'system', 'edge_function');

comment on type public.visit_status is
  'Nao contem disponivel: e a ausencia de visita ativa, derivada em consulta. Ver ADR 0002.';
comment on type public.operational_status is
  'bloqueio_solicitado nao e bloqueio. suspenso e reversivel. encerrado e definitivo.';
