import type { VisitStatus } from "@/constants/visit-status";

/**
 * Visita. Nao tem action_id: a ligacao com acoes e N:N via VisitAction, para uma
 * unica ida resolver varias modalidades (ADR 0002).
 */
export interface Visit {
  id: string;
  establishmentId: string;
  consultantId: string;
  status: VisitStatus;
  reservedAt: string;
  expiresAt: string | null;
  checkinAt: string | null;
  completedAt: string | null;
  /** Preenchido apenas em excecao do supervisor. E o que o indice unico ignora. */
  overrideReason: string | null;
  overrideBy: string | null;
}

export interface VisitAction {
  visitId: string;
  fieldActionId: string;
}

export interface VisitAttachment {
  id: string;
  visitId: string;
  storagePath: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
  createdAt: string;
}
