import type { RegistrationStatus } from "@/constants/establishment-status";
import type { OperationalStatus } from "@/constants/operational-status";
import type { TransactionStatus } from "@/constants/transaction-status";

/**
 * Ponto credenciado (ADR 0001). A identidade e o contrato externo; o CNPJ e
 * atributo, porque o mesmo CNPJ tem varias lojas.
 * Implementacao na Sprint 1: o tipo existe agora para as regras compartilhadas.
 */
export interface Establishment {
  id: string;
  externalContract: string | null;
  cnpj: string | null;
  legalName: string;
  tradeName: string;
  segmentId: string | null;
  registrationStatus: RegistrationStatus;
  operationalStatus: OperationalStatus;
  lastTransactionAt: string | null;
  neverTransacted: boolean;
}

export interface EstablishmentAddress {
  id: string;
  establishmentId: string;
  street: string;
  cep: string | null;
  city: string;
  state: string;
  normalizedAddress: string;
  latitude: number | null;
  longitude: number | null;
  isCurrent: boolean;
}

/** As cinco dimensoes juntas, como o mapa e a ficha precisam. */
export interface EstablishmentStatusView {
  registration: RegistrationStatus;
  operational: OperationalStatus;
  transaction: TransactionStatus;
  daysSinceTransaction: number | null;
}
