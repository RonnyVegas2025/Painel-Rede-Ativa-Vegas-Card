import type { OccurrenceStatus } from "@/constants/occurrence-status";

export interface Occurrence {
  id: string;
  establishmentId: string;
  visitId: string | null;
  status: OccurrenceStatus;
  category: string;
  description: string;
  openedBy: string;
  openedAt: string;
  resolvedAt: string | null;
}

export interface BlockRequest {
  id: string;
  occurrenceId: string;
  establishmentId: string;
  requestedBy: string;
  /** Vazio = bloqueio total. Preenchido = bloqueio apenas nas modalidades listadas. */
  affectedProductIds: string[];
  reason: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decision: string | null;
}
