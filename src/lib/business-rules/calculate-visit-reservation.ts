import { VISIT_EXPIRES_FROM, VISIT_ACTIVE_STATUSES, type VisitStatus } from "@/constants/visit-status";

export function calculateReservationExpiry(reservedAt: Date, minutes: number): Date {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new RangeError(`visit_reservation_minutes invalido: ${minutes}`);
  }
  return new Date(reservedAt.getTime() + minutes * 60_000);
}

/** Check-in interrompe a expiracao: a partir dali o consultor esta no local. */
export function isReservationExpired(
  status: VisitStatus,
  expiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (expiresAt === null) return false;
  if (!VISIT_EXPIRES_FROM.includes(status)) return false;
  return now.getTime() >= expiresAt.getTime();
}

export function minutesRemaining(expiresAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000));
}

export interface ReservationAttempt {
  activeReservationsOfConsultant: number;
  maximumActiveReservations: number;
  establishmentHasActiveVisit: boolean;
  establishmentIsAvailable: boolean;
}

export type ReservationDenial =
  | "estabelecimento_indisponivel"
  | "ja_reservado"
  | "limite_atingido";

export interface ReservationCheck {
  allowed: boolean;
  denial: ReservationDenial | null;
  message: string;
}

/**
 * Verificacao antecipada, para a interface explicar antes de chamar a RPC.
 *
 * NAO e a garantia. A garantia e o indice unico parcial e o advisory lock do
 * ADR 0002. Entre esta checagem e a RPC ha uma janela de corrida de segundos, e
 * a resposta da RPC sempre vence.
 */
export function canReserve(attempt: ReservationAttempt): ReservationCheck {
  if (!attempt.establishmentIsAvailable) {
    return {
      allowed: false,
      denial: "estabelecimento_indisponivel",
      message: "Estabelecimento bloqueado, suspenso ou encerrado.",
    };
  }
  if (attempt.establishmentHasActiveVisit) {
    return {
      allowed: false,
      denial: "ja_reservado",
      message: "Já existe uma visita ativa neste estabelecimento.",
    };
  }
  if (attempt.activeReservationsOfConsultant >= attempt.maximumActiveReservations) {
    return {
      allowed: false,
      denial: "limite_atingido",
      message: `Limite de ${attempt.maximumActiveReservations} reservas ativas atingido. Conclua uma visita para reservar outra.`,
    };
  }
  return { allowed: true, denial: null, message: "" };
}

export function blocksNewReservation(status: VisitStatus): boolean {
  return VISIT_ACTIVE_STATUSES.includes(status);
}
