/** Dimensao cadastral: vem da planilha. Nunca e prova de que o comercio funciona. */
export const REGISTRATION_STATUS = {
  ATIVO: "ativo",
  BLOQUEADO: "bloqueado",
  CANCELADO: "cancelado",
  EM_ANALISE: "em_analise",
} as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  ativo: "Ativo",
  bloqueado: "Bloqueado",
  cancelado: "Cancelado",
  em_analise: "Em análise",
};
