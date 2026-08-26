import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSettings, toRecencyThresholds } from "@/lib/settings/get-settings";
import { calculateTransactionStatus, daysSinceTransaction } from "@/lib/business-rules/calculate-transaction-status";
import type { TransactionStatus } from "@/constants/transaction-status";
import type { OperationalStatus } from "@/constants/operational-status";
import type { RegistrationStatus } from "@/constants/establishment-status";

export interface PontoDeCaptura {
  meio: string | null;
  status: string;
  isPrimary: boolean | null;
  inactivatedAt: string | null;
}

export interface Ficha {
  id: string;
  tradeName: string;
  legalName: string;
  externalContract: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  origin: string | null;
  acquisitionChannel: string | null;
  /** Texto CRU da planilha. Nunca casado com `profiles` — Sprint 3. */
  assignedConsultantsRaw: string | null;
  description: string | null;
  relationshipStartDate: string | null;
  lastTransactionAt: string | null;
  neverTransacted: boolean;
  diasSemTransacao: number | null;
  segmento: string | null;
  segmentoCru: string | null;
  cadastral: RegistrationStatus;
  transacional: TransactionStatus;
  operacional: OperationalStatus;
  visita: null;
  ocorrencia: null;
  absentSince: string | null;
  endereco: {
    rua: string | null;
    numero: string | null;
    bairro: string | null;
    cep: string | null;
    cidade: string;
    estado: string;
    bruto: string;
  } | null;
  pontos: PontoDeCaptura[];
}

export async function lerFicha(id: string): Promise<Ficha | null> {
  const supabase = await createClient();
  const limites = toRecencyThresholds(await getSettings());

  const { data, error } = await supabase
    .from("establishments")
    .select(
      `id, trade_name, legal_name, external_contract, cnpj, phone, email, origin,
       acquisition_channel, assigned_consultants_raw, description,
       relationship_start_date, last_transaction_at, never_transacted,
       registration_status, operational_status, absent_since,
       segments(normalized_name, source_name),
       establishment_addresses(street, street_name, street_number, district, cep, city, state, is_current),
       establishment_capture_points(status, is_primary, inactivated_at, capture_methods(source_name))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler o estabelecimento: ${error.message}`);
  if (!data) return null;

  const corrente = (data.establishment_addresses ?? []).find((a) => a.is_current);

  return {
    id: data.id,
    tradeName: data.trade_name,
    legalName: data.legal_name,
    externalContract: data.external_contract,
    cnpj: data.cnpj,
    phone: data.phone,
    email: data.email,
    origin: data.origin,
    acquisitionChannel: data.acquisition_channel,
    assignedConsultantsRaw: data.assigned_consultants_raw,
    description: data.description,
    relationshipStartDate: data.relationship_start_date,
    lastTransactionAt: data.last_transaction_at,
    neverTransacted: data.never_transacted,
    diasSemTransacao: data.never_transacted
      ? null
      : daysSinceTransaction(data.last_transaction_at ? new Date(data.last_transaction_at) : null),
    segmento: data.segments?.normalized_name ?? null,
    segmentoCru: data.segments?.source_name ?? null,
    cadastral: data.registration_status as RegistrationStatus,
    transacional: data.never_transacted
      ? "nunca_transacionou"
      : calculateTransactionStatus(
          data.last_transaction_at ? new Date(data.last_transaction_at) : null,
          limites,
        ),
    operacional: data.operational_status as OperationalStatus,
    visita: null,
    ocorrencia: null,
    absentSince: data.absent_since,
    endereco: corrente
      ? {
          rua: corrente.street_name,
          numero: corrente.street_number,
          bairro: corrente.district,
          cep: corrente.cep,
          cidade: corrente.city,
          estado: corrente.state,
          bruto: corrente.street,
        }
      : null,
    // Inativos ficam, com a data: comércio que trocou de adquirente é o que a
    // Sprint 7 olha ao abrir atendimento.
    pontos: (data.establishment_capture_points ?? [])
      .map((p) => ({
        meio: p.capture_methods?.source_name ?? null,
        status: p.status,
        isPrimary: p.is_primary,
        inactivatedAt: p.inactivated_at,
      }))
      .sort((a, b) => Number(b.status === "ativo") - Number(a.status === "ativo")),
  };
}
