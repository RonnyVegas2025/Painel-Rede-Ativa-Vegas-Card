/** Dimensao operacional: confirmada em campo. */
export const OPERATIONAL_STATUS = {
  APTO: "apto",
  PROBLEMA_TECNICO: "problema_tecnico",
  FECHADO_TEMPORARIAMENTE: "fechado_temporariamente",
  ENCERRADO: "encerrado",
  MUDANCA_PROPRIETARIO: "mudanca_proprietario",
  MUDANCA_ENDERECO: "mudanca_endereco",
  EQUIPAMENTO_INDISPONIVEL: "equipamento_indisponivel",
  BLOQUEIO_SOLICITADO: "bloqueio_solicitado",
  SUSPENSO: "suspenso",
  EM_REATIVACAO: "em_reativacao",
} as const;

export type OperationalStatus = (typeof OPERATIONAL_STATUS)[keyof typeof OPERATIONAL_STATUS];

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  apto: "Apto",
  problema_tecnico: "Problema técnico",
  fechado_temporariamente: "Fechado temporariamente",
  encerrado: "Encerrado",
  mudanca_proprietario: "Mudança de proprietário",
  mudanca_endereco: "Mudança de endereço",
  equipamento_indisponivel: "Equipamento indisponível",
  bloqueio_solicitado: "Bloqueio solicitado",
  suspenso: "Suspenso",
  em_reativacao: "Em reativação",
};

/** Sai das listas de aptos. suspenso e reversivel; encerrado nao. */
export const OPERATIONAL_UNAVAILABLE: readonly OperationalStatus[] = [
  OPERATIONAL_STATUS.SUSPENSO,
  OPERATIONAL_STATUS.ENCERRADO,
];

/**
 * Pendencia que o mapa sinaliza, sem impedir visita.
 * bloqueio_solicitado esta aqui e nao em UNAVAILABLE de proposito: e pedido
 * pendente, o estabelecimento continua operando ate a decisao do administrativo.
 */
export const OPERATIONAL_PENDING: readonly OperationalStatus[] = [
  OPERATIONAL_STATUS.PROBLEMA_TECNICO,
  OPERATIONAL_STATUS.BLOQUEIO_SOLICITADO,
  OPERATIONAL_STATUS.EQUIPAMENTO_INDISPONIVEL,
  OPERATIONAL_STATUS.MUDANCA_PROPRIETARIO,
  OPERATIONAL_STATUS.MUDANCA_ENDERECO,
];
