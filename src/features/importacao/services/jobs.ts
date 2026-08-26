import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ImportRowStatus } from "@/lib/business-rules/classify-import-row";

/** Espelha `public.import_job_status`. */
export type ImportJobStatus =
  | "processando"
  | "previa"
  | "aplicando"
  | "concluida"
  | "cancelada"
  | "falhou";

export interface JobPendente {
  id: string;
  fileName: string;
  scopeCity: string | null;
  status: ImportJobStatus;
  startedAt: string;
  totalRows: number;
  /** Preenchido quando este job substitui outro por redeclaração de escopo. */
  derivadoDeId: string | null;
  /**
   * Preenchido quando OUTRO job foi criado a partir deste.
   *
   * Existe por causa da janela dos dois tempos: entre criar a derivada e
   * descartar a original, os dois estão vivos. Se o Node cair no meio, o
   * transitório vira permanente — duas prévias aplicáveis e o operador sem saber
   * qual. Sem este campo o estado é visível e ilegível, que é quase o mesmo que
   * invisível.
   */
  substituidoPorId: string | null;
}

/**
 * As prévias que esperam decisão.
 *
 * ESCOPO: só pendentes. Histórico de concluídas, relatório por estado e
 * resolução de ausentes são **E-008** — ver `docs/roadmap.md`. A lista existe
 * aqui porque sem ela não há como chegar à prévia, que é o E-006.
 */
export async function listarPendentes(): Promise<JobPendente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select("id, file_name, scope_city, status, started_at, total_rows, derivado_de_id")
    .in("status", ["processando", "previa"])
    .order("started_at", { ascending: false });

  if (error) throw new Error(`Falha ao listar importações pendentes: ${error.message}`);

  const ids = (data ?? []).map((j) => j.id);
  // Quem foi substituído por quem. Uma consulta, não uma por linha.
  const { data: derivadas } = ids.length
    ? await supabase
        .from("import_jobs")
        .select("id, derivado_de_id")
        .in("derivado_de_id", ids)
    : { data: [] };

  const substituidoPor = new Map<string, string>();
  for (const d of derivadas ?? []) {
    if (d.derivado_de_id) substituidoPor.set(d.derivado_de_id, d.id);
  }

  return (data ?? []).map((j) => ({
    id: j.id,
    fileName: j.file_name,
    scopeCity: j.scope_city,
    status: j.status as ImportJobStatus,
    startedAt: j.started_at,
    totalRows: j.total_rows,
    derivadoDeId: j.derivado_de_id,
    substituidoPorId: substituidoPor.get(j.id) ?? null,
  }));
}

export interface ContagemPorStatus {
  novo: number;
  atualizado: number;
  inalterado: number;
  conflito: number;
  erro: number;
  ausente: number;
}

export interface ExemploAusente {
  tradeName: string;
  lastTransactionAt: string | null;
  neverTransacted: boolean;
}

export interface ResumoDeAusentes {
  ausentes: number;
  noEscopo: number;
  percentual: number;
  limiar: number | null;
  excede: boolean;
  exemplos: ExemploAusente[];
}

export interface CidadeNoArquivo {
  cidade: string | null;
  linhas: number;
}

export interface Previa {
  id: string;
  fileName: string;
  scopeCity: string | null;
  status: ImportJobStatus;
  totalRows: number;
  duplicatedCaptureMethods: number;
  addressesWithoutNumber: number;
  derivadoDeId: string | null;
  contagens: ContagemPorStatus;
  cidades: CidadeNoArquivo[];
  ausentes: ResumoDeAusentes;
}

/**
 * Os agregados da prévia.
 *
 * As contagens vêm de `group by` no banco. Carregar as 1.804 linhas para contar
 * em JavaScript funciona hoje e falha **em silêncio** na primeira base de 20 mil:
 * o PostgREST devolve os primeiros `max_rows` e a contagem sai errada sem erro
 * nenhum. É a mesma forma dos outros defeitos desta sprint — a verificação
 * passaria a responder outra pergunta.
 */
export async function lerPrevia(id: string): Promise<Previa | null> {
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("import_jobs")
    .select(
      "id, file_name, scope_city, status, total_rows, duplicated_capture_methods, addresses_without_number, created_count, updated_count, unchanged_count, conflict_count, error_count, derivado_de_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler a importação: ${error.message}`);
  if (!job) return null;

  const [{ data: cidades }, { data: resumo }] = await Promise.all([
    supabase.rpc("import_cities", { p_import_id: id }),
    supabase.rpc("import_absent_summary", { p_import_id: id }),
  ]);

  const r = (resumo ?? {}) as Record<string, unknown>;

  return {
    id: job.id,
    fileName: job.file_name,
    scopeCity: job.scope_city,
    status: job.status as ImportJobStatus,
    totalRows: job.total_rows,
    duplicatedCaptureMethods: job.duplicated_capture_methods,
    addressesWithoutNumber: job.addresses_without_number,
    derivadoDeId: job.derivado_de_id,
    contagens: {
      novo: job.created_count,
      atualizado: job.updated_count,
      inalterado: job.unchanged_count,
      conflito: job.conflict_count,
      erro: job.error_count,
      ausente: Number(r.ausentes ?? 0),
    },
    cidades: (cidades ?? []).map((c: { cidade: string | null; linhas: number }) => ({
      cidade: c.cidade,
      linhas: Number(c.linhas),
    })),
    ausentes: {
      ausentes: Number(r.ausentes ?? 0),
      noEscopo: Number(r.no_escopo ?? 0),
      percentual: Number(r.percentual ?? 0),
      limiar: r.limiar === null || r.limiar === undefined ? null : Number(r.limiar),
      excede: Boolean(r.excede),
      exemplos: ((r.exemplos ?? []) as Array<Record<string, unknown>>).map((e) => ({
        tradeName: String(e.trade_name ?? ""),
        lastTransactionAt: (e.last_transaction_at as string | null) ?? null,
        neverTransacted: Boolean(e.never_transacted),
      })),
    },
  };
}

export interface LinhaDaPrevia {
  lineNumber: number;
  status: string;
  motivo: string | null;
  empresa: string;
  cidade: string | null;
  contrato: string | null;
}

export const LINHAS_POR_PAGINA = 50;

/**
 * As linhas, paginadas e filtradas por estado.
 *
 * 1.804 linhas não cabem numa tela, e a decisão é sobre os agregados — o detalhe
 * serve para conferir uma suspeita. `range` no banco, nunca `slice` depois.
 */
export async function listarLinhas(
  id: string,
  status: ImportRowStatus | null,
  pagina: number,
): Promise<{ linhas: LinhaDaPrevia[]; total: number }> {
  const supabase = await createClient();
  const inicio = (pagina - 1) * LINHAS_POR_PAGINA;

  let q = supabase
    .from("import_rows")
    .select("line_number, status, error_message, raw_data", { count: "exact" })
    .eq("import_id", id)
    .order("line_number", { ascending: true })
    .range(inicio, inicio + LINHAS_POR_PAGINA - 1);

  if (status) q = q.eq("status", status);

  const { data, error, count } = await q;
  if (error) throw new Error(`Falha ao listar linhas: ${error.message}`);

  return {
    total: count ?? 0,
    linhas: (data ?? []).map((l) => {
      const raw = (l.raw_data ?? {}) as Record<string, unknown>;
      return {
        lineNumber: l.line_number,
        status: l.status,
        motivo: l.error_message,
        empresa: String(raw.trade_name ?? raw.legal_name ?? ""),
        cidade: (raw.city as string | null) ?? null,
        contrato: (raw.external_contract as string | null) ?? null,
      };
    }),
  };
}

// ===========================================================================
// E-008
// ===========================================================================

export interface JobConcluido {
  id: string;
  fileName: string;
  scopeCity: string | null;
  status: ImportJobStatus;
  startedAt: string;
  finishedAt: string | null;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  conflictCount: number;
  errorCount: number;
  missingCount: number;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  errorMessage: string | null;
  derivadoDeId: string | null;
}

/** O histórico: o que ENTROU na base. A prévia é sobre o que vai entrar. */
export async function listarHistorico(limite = 30): Promise<JobConcluido[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .select(
      "id, file_name, scope_city, status, started_at, finished_at, total_rows, created_count, updated_count, unchanged_count, conflict_count, error_count, missing_count, requires_confirmation, confirmed_at, error_message, derivado_de_id",
    )
    .in("status", ["concluida", "cancelada", "falhou"])
    .order("started_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(`Falha ao ler o histórico: ${error.message}`);
  return (data ?? []).map((j) => ({
    id: j.id,
    fileName: j.file_name,
    scopeCity: j.scope_city,
    status: j.status as ImportJobStatus,
    startedAt: j.started_at,
    finishedAt: j.finished_at,
    totalRows: j.total_rows,
    createdCount: j.created_count,
    updatedCount: j.updated_count,
    unchangedCount: j.unchanged_count,
    conflictCount: j.conflict_count,
    errorCount: j.error_count,
    missingCount: j.missing_count,
    requiresConfirmation: j.requires_confirmation,
    confirmedAt: j.confirmed_at,
    errorMessage: j.error_message,
    derivadoDeId: j.derivado_de_id,
  }));
}

export interface Ausente {
  id: string;
  tradeName: string;
  externalContract: string | null;
  cidade: string | null;
  segmento: string | null;
  absentSince: string;
  /** De qual importação. Ausentes do mesmo arquivo se resolvem juntos. */
  absentFromImport: string | null;
  arquivo: string | null;
  lastTransactionAt: string | null;
  neverTransacted: boolean;
}

/**
 * A fila de ausentes.
 *
 * Ordenada por **transação mais recente primeiro**, e não por data de ausência.
 * Um comércio que transacionou semana passada e sumiu do arquivo é o sinal mais
 * forte de que o escopo estava errado — a mesma lógica dos exemplos da confirmação
 * deliberada, aplicada à fila inteira. Ordenar por "ausente há mais tempo" poria
 * no topo justamente os casos já mortos.
 */
export async function listarAusentes(importId: string | null): Promise<Ausente[]> {
  const supabase = await createClient();
  let q = supabase
    .from("establishments")
    .select(
      `id, trade_name, external_contract, last_transaction_at, never_transacted,
       absent_since, absent_from_import,
       segments(normalized_name),
       establishment_addresses(city, is_current),
       import_jobs!establishments_absent_from_import_fkey(file_name)`,
    )
    .not("absent_since", "is", null)
    .eq("is_active", true)
    .order("last_transaction_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (importId) q = q.eq("absent_from_import", importId);

  const { data, error } = await q;
  if (error) throw new Error(`Falha ao listar ausentes: ${error.message}`);

  return (data ?? []).map((e) => ({
    id: e.id,
    tradeName: e.trade_name,
    externalContract: e.external_contract,
    cidade: (e.establishment_addresses ?? []).find((a) => a.is_current)?.city ?? null,
    segmento: e.segments?.normalized_name ?? null,
    absentSince: e.absent_since!,
    absentFromImport: e.absent_from_import,
    arquivo: e.import_jobs?.file_name ?? null,
    lastTransactionAt: e.last_transaction_at,
    neverTransacted: e.never_transacted,
  }));
}
