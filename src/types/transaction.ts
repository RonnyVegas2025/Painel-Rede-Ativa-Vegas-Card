export interface EstablishmentTransaction {
  id: string;
  establishmentId: string;
  occurredAt: string;
  amount: number | null;
  cardProductId: string | null;
  terminal: string | null;
}
