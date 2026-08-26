import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSettings, toRecencyThresholds } from "@/lib/settings/get-settings";
import type { TransactionStatus } from "@/constants/transaction-status";
import type { OperationalStatus } from "@/constants/operational-status";
import type { RegistrationStatus } from "@/constants/establishment-status";
import { calculateTransactionStatus } from "@/lib/business-rules/calculate-transaction-status";
import {
  ORDENACAO_POR_RECENCIA,
  intervaloDeRecencia,
} from "@/lib/business-rules/intervalo-de-recencia";

export const POR_PAGINA = 50;

export interface Filtros {
  busca: string | null;
  transacional: TransactionStatus | null;
  operacional: OperationalStatus | null;
  cadastral: RegistrationStatus | null;
  segmentoId: string | null;
  cidade: string | null;
  /** Marcados como ausentes por uma importação. Fila do E-008. */
  ausentes: boolean;
  ordem: "recentes" | "antigos" | "nome";
}

export interface LinhaDaListagem {
  id: string;
  tradeName: string;
  legalName: string;
  externalContract: string | null;
  cnpj: string | null;
  cidade: string | null;
  bairro: string | null;
  segmento: string | null;
  /** As cinco dimensões, separadas. Ver ADR 0004. */
  cadastral: RegistrationStatus;
  transacional: TransactionStatus;
  operacional: OperationalStatus;
  /** Sprint 3. Nulo aqui não é "sem visita": é "a dimensão ainda não existe". */
  visita: null;
  /** Sprint 5. */
  ocorrencia: null;
  lastTransactionAt: string | null;
  neverTransacted: boolean;
  absentSince: string | null;
}

/**
 * A listagem.
 *
 * ## O filtro transacional NÃO calcula o status
 *
 * `calculate_transaction_status` é `STABLE` e lê `system_settings`: não é
 * indexável. Filtrar calculando o status de cada linha e descartando o resto faz
 * varredura completa a cada troca de filtro — com 1.804 ninguém percebe, com 20
 * mil o sintoma aparece meses depois, longe da causa.
 *
 * `intervaloDeRecencia` converte o status no intervalo de `last_transaction_at`,
 * que é indexado. O status ainda é calculado — mas só para as ~50 linhas da
 * página, para exibir o rótulo.
 *
 * A ordenação segue a mesma disciplina: ordena pela DATA, não pelo derivado.
 */
export async function listar(
  filtros: Filtros,
  pagina: number,
): Promise<{ linhas: LinhaDaListagem[]; total: number }> {
  const supabase = await createClient();
  const limites = toRecencyThresholds(await getSettings());
  const inicio = (pagina - 1) * POR_PAGINA;

  let q = supabase
    .from("establishments")
    .select(
      `id, trade_name, legal_name, external_contract, cnpj, registration_status,
       operational_status, last_transaction_at, never_transacted, absent_since,
       segments(normalized_name),
       establishment_addresses!inner(city, district, is_current)`,
      { count: "exact" },
    )
    .eq("is_active", true)
    .eq("establishment_addresses.is_current", true);

  if (filtros.busca) {
    const t = filtros.busca.replace(/[%,()]/g, " ").trim();
    if (t !== "") {
      q = q.or(
        `trade_name.ilike.%${t}%,legal_name.ilike.%${t}%,external_contract.ilike.%${t}%,cnpj.ilike.%${t}%`,
      );
    }
  }
  if (filtros.cadastral) q = q.eq("registration_status", filtros.cadastral);
  if (filtros.operacional) q = q.eq("operational_status", filtros.operacional);
  if (filtros.segmentoId) q = q.eq("segment_id", filtros.segmentoId);
  if (filtros.cidade) q = q.eq("establishment_addresses.city", filtros.cidade);
  if (filtros.ausentes) q = q.not("absent_since", "is", null);

  if (filtros.transacional) {
    const i = intervaloDeRecencia(filtros.transacional, limites);
    if (i.apenasNuncaTransacionou) {
      // A flag é explícita, e não inferida por nulo (ADR 0009): nulo sem a flag
      // significa dado não informado, que é outra coisa.
      q = q.eq("never_transacted", true);
    } else {
      q = q.eq("never_transacted", false);
      if (i.desde) q = q.gte("last_transaction_at", i.desde.toISOString());
      if (i.ate) q = q.lt("last_transaction_at", i.ate.toISOString());
    }
  }

  const o = ORDENACAO_POR_RECENCIA;
  if (filtros.ordem === "nome") q = q.order("trade_name", { ascending: true });
  else if (filtros.ordem === "antigos") q = q.order(o.coluna, o.maisAntigosPrimeiro);
  else q = q.order(o.coluna, o.maisRecentesPrimeiro);

  const { data, error, count } = await q.range(inicio, inicio + POR_PAGINA - 1);
  if (error) throw new Error(`Falha ao listar estabelecimentos: ${error.message}`);

  return {
    total: count ?? 0,
    linhas: (data ?? []).map((e) => {
      const endereco = (e.establishment_addresses ?? [])[0];
      return {
        id: e.id,
        tradeName: e.trade_name,
        legalName: e.legal_name,
        externalContract: e.external_contract,
        cnpj: e.cnpj,
        cidade: endereco?.city ?? null,
        bairro: endereco?.district ?? null,
        segmento: e.segments?.normalized_name ?? null,
        cadastral: e.registration_status as RegistrationStatus,
        // Calculado só para as linhas da página, para o rótulo.
        transacional: e.never_transacted
          ? "nunca_transacionou"
          : calculateTransactionStatus(
              e.last_transaction_at ? new Date(e.last_transaction_at) : null,
              limites,
            ),
        operacional: e.operational_status as OperationalStatus,
        visita: null,
        ocorrencia: null,
        lastTransactionAt: e.last_transaction_at,
        neverTransacted: e.never_transacted,
        absentSince: e.absent_since,
      };
    }),
  };
}

export interface OpcoesDeFiltro {
  cidades: string[];
  segmentos: { id: string; nome: string }[];
}

export async function lerOpcoes(): Promise<OpcoesDeFiltro> {
  const supabase = await createClient();
  const [{ data: cidades }, { data: segmentos }] = await Promise.all([
    supabase.from("establishment_addresses").select("city").eq("is_current", true),
    supabase.from("segments").select("id, normalized_name").eq("is_active", true)
      .order("normalized_name"),
  ]);
  return {
    cidades: [...new Set((cidades ?? []).map((c) => c.city).filter(Boolean))].sort(),
    segmentos: (segmentos ?? []).map((s) => ({ id: s.id, nome: s.normalized_name })),
  };
}
