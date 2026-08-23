/** Dimensao de ocorrencia. */
export const OCCURRENCE_STATUS = {
  ABERTA: "aberta",
  EM_ANALISE: "em_analise",
  AGUARDANDO_INFORMACAO: "aguardando_informacao",
  APROVADA: "aprovada",
  REJEITADA: "rejeitada",
  RESOLVIDA: "resolvida",
  CANCELADA: "cancelada",
} as const;

export type OccurrenceStatus = (typeof OCCURRENCE_STATUS)[keyof typeof OCCURRENCE_STATUS];

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_informacao: "Aguardando informação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

/** Em tratamento: pesa na prioridade 3 do marcador (ADR 0004). */
export const OCCURRENCE_OPEN_STATUSES: readonly OccurrenceStatus[] = [
  OCCURRENCE_STATUS.ABERTA,
  OCCURRENCE_STATUS.EM_ANALISE,
];
