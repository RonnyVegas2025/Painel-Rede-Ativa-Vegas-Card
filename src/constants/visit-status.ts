/**
 * Dimensao de visita.
 * 'disponivel' NAO esta aqui: e a ausencia de visita ativa, derivada em consulta.
 * O enum do banco tambem nao o contem. Ver ADR 0002 e docs/status-flows.md.
 */
export const VISIT_STATUS = {
  RESERVADA: "reservada",
  EM_DESLOCAMENTO: "em_deslocamento",
  CHECKIN_REALIZADO: "checkin_realizado",
  EM_ATENDIMENTO: "em_atendimento",
  CONCLUIDA: "concluida",
  CANCELADA: "cancelada",
  EXPIRADA: "expirada",
} as const;

export type VisitStatus = (typeof VISIT_STATUS)[keyof typeof VISIT_STATUS];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  reservada: "Reservada",
  em_deslocamento: "Em deslocamento",
  checkin_realizado: "Check-in realizado",
  em_atendimento: "Em atendimento",
  concluida: "Concluída",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

/**
 * Estados que bloqueiam nova reserva. Precisa bater exatamente com a clausula
 * WHERE do indice unico parcial visits_um_ativo_por_estabelecimento.
 * Divergir daqui e do banco significa a interface prometer o que a RPC vai negar.
 */
export const VISIT_ACTIVE_STATUSES: readonly VisitStatus[] = [
  VISIT_STATUS.RESERVADA,
  VISIT_STATUS.EM_DESLOCAMENTO,
  VISIT_STATUS.CHECKIN_REALIZADO,
  VISIT_STATUS.EM_ATENDIMENTO,
];

/** A partir do check-in a reserva nao expira mais. */
export const VISIT_EXPIRES_FROM: readonly VisitStatus[] = [
  VISIT_STATUS.RESERVADA,
  VISIT_STATUS.EM_DESLOCAMENTO,
];
