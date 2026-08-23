import { OCCURRENCE_OPEN_STATUSES, type OccurrenceStatus } from "@/constants/occurrence-status";
import {
  OPERATIONAL_PENDING,
  OPERATIONAL_STATUS,
  type OperationalStatus,
} from "@/constants/operational-status";
import { REGISTRATION_STATUS, type RegistrationStatus } from "@/constants/establishment-status";
import { TRANSACTION_STATUS_TOKENS, type TransactionStatus } from "@/constants/transaction-status";
import { VISIT_ACTIVE_STATUSES, type VisitStatus } from "@/constants/visit-status";

export type MarkerPriority = "indisponivel" | "visita_ativa" | "pendencia" | "transacional";

export interface EstablishmentStatusSet {
  registration: RegistrationStatus;
  operational: OperationalStatus;
  transaction: TransactionStatus;
  visit: VisitStatus | null; // null = sem visita = disponivel
  occurrence: OccurrenceStatus | null;
}

export interface MarkerResolution {
  priority: MarkerPriority;
  colorToken: string;
  /** Motivo em texto. Vai para o aria-label junto com as cinco dimensoes. */
  reason: string;
}

/**
 * Precedencia do ADR 0004. Resolve apenas a COR do pino.
 * O popup e o painel lateral continuam mostrando as cinco dimensoes separadas:
 * a precedencia nao apaga informacao, so decide o que a cor representa.
 */
export function resolveMarkerStatus(status: EstablishmentStatusSet): MarkerResolution {
  // 1. Indisponibilidade ou bloqueio.
  if (
    status.registration === REGISTRATION_STATUS.BLOQUEADO ||
    status.registration === REGISTRATION_STATUS.CANCELADO
  ) {
    return {
      priority: "indisponivel",
      colorToken: "--vg-status-bloqueado",
      reason: status.registration === REGISTRATION_STATUS.BLOQUEADO ? "Bloqueado" : "Cancelado",
    };
  }
  if (
    status.operational === OPERATIONAL_STATUS.SUSPENSO ||
    status.operational === OPERATIONAL_STATUS.ENCERRADO
  ) {
    return {
      priority: "indisponivel",
      colorToken: "--vg-status-bloqueado",
      reason: status.operational === OPERATIONAL_STATUS.SUSPENSO ? "Suspenso" : "Encerrado",
    };
  }

  // 2. Visita ativa.
  if (status.visit !== null && VISIT_ACTIVE_STATUSES.includes(status.visit)) {
    return { priority: "visita_ativa", colorToken: "--vg-status-reservado", reason: "Visita em andamento" };
  }

  // 3. Pendencia operacional ou ocorrencia em tratamento.
  if (OPERATIONAL_PENDING.includes(status.operational)) {
    return { priority: "pendencia", colorToken: "--vg-status-pendencia", reason: "Pendência operacional" };
  }
  if (status.occurrence !== null && OCCURRENCE_OPEN_STATUSES.includes(status.occurrence)) {
    return { priority: "pendencia", colorToken: "--vg-status-pendencia", reason: "Ocorrência em tratamento" };
  }

  // 4. Recencia.
  return {
    priority: "transacional",
    colorToken: TRANSACTION_STATUS_TOKENS[status.transaction],
    reason: "Situação transacional",
  };
}
