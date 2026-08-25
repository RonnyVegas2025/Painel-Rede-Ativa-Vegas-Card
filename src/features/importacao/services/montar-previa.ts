import "server-only";

import { createClient } from "@/lib/supabase/server";
import { lerPlanilha } from "./ler-planilha";
import {
  normalizeLinhaImportacao,
  type LinhaNormalizada,
} from "@/lib/business-rules/normalize-linha-importacao";
import {
  classifyImportRow,
  type EstabelecimentoExistente,
  type EstadoAtual,
} from "@/lib/business-rules/classify-import-row";
import { resumirImportacao } from "@/lib/business-rules/resumir-importacao";

/** Em lotes: um `insert` de 1.804 linhas estoura o corpo da requisição. */
const LOTE = 250;

/**
 * Monta a prévia: lê o arquivo, classifica e grava `import_rows`.
 *
 * ## A prévia NÃO escreve nas tabelas de domínio
 *
 * `import_jobs` e `import_rows` são a SAÍDA dela — é delas que saem o relatório,
 * o histórico e a lista de ausentes. O critério é sobre `establishments`,
 * `establishment_addresses`, `establishment_capture_points`, `capture_methods`,
 * `segments` e `product_segments`, e nenhuma é tocada aqui.
 *
 * ## Escreve com o cliente do USUÁRIO
 *
 * Não com `service_role`. A policy de INSERT em `import_rows` existe justamente
 * para isso: sem ela, a única forma de gravar seria ignorando a RLS, e a checagem
 * de papel da RPC de criação não protegeria nada (migration 0041).
 */
export async function montarPrevia(importId: string, arquivo: Buffer): Promise<void> {
  const supabase = await createClient();

  const { linhas: cruas } = await lerPlanilha(arquivo);

  // O estado atual, lido uma vez e passado por ARGUMENTO para a regra pura.
  const estado = await lerEstadoAtual();

  const normalizadas: LinhaNormalizada[] = [];
  const registros = cruas.map((crua, i) => {
    const linha = normalizeLinhaImportacao(crua);
    normalizadas.push(linha);
    const c = classifyImportRow(linha, estado);
    return {
      import_id: importId,
      // Linha da PLANILHA: o cabeçalho é a 1. `import_finalize_preview` depende
      // disso para detectar lote parcial sem confiar no total que enviamos.
      line_number: i + 2,
      status: c.status,
      establishment_id: c.establishmentId,
      error_message: c.motivo,
      raw_data: paraRaw(linha),
    };
  });

  for (let i = 0; i < registros.length; i += LOTE) {
    const { error } = await supabase.from("import_rows").insert(registros.slice(i, i + LOTE));
    if (error) throw new Error(`Falha ao gravar a prévia na linha ${i + 2}: ${error.message}`);
  }

  const resumo = resumirImportacao(
    normalizadas.map((linha, i) => ({ linha, status: registros[i]!.status })),
    0,
    0,
    100,
  );

  // A conferência acontece no BANCO, sobre o que ficou gravado — não sobre o que
  // este código acha que gravou.
  const { error } = await supabase.rpc("import_finalize_preview", {
    p_import_id: importId,
    p_total_lido: cruas.length,
    p_duplicados: resumo.duplicatedCaptureMethods,
    p_sem_numero: resumo.addressesWithoutNumber,
  });
  if (error) throw new Error(error.message);
}

function paraRaw(l: LinhaNormalizada) {
  return {
    external_contract: l.externalContract,
    cnpj: l.cnpj,
    legal_name: l.legalName,
    trade_name: l.tradeName,
    registration_status_raw: l.registrationStatusRaw,
    description: l.descriptionRaw,
    segment_source_name: l.segmentSourceName,
    cnae_hint: l.cnaeHint,
    capture_methods: l.captureMethodSourceNames,
    endereco_bruto: l.enderecoBruto,
    street_name: l.endereco?.streetName ?? null,
    street_number: l.endereco?.streetNumber ?? null,
    district: l.endereco?.district ?? null,
    endereco_sem_numero: l.enderecoSemNumero,
    endereco_hash: l.enderecoHash,
    cep: l.cep,
    // CRUA, sem normalizar: a comparação com o escopo declarado precisa mostrar
    // `São Paulo` e `SAO PAULO` como duas grafias se for o caso.
    city: l.city,
    state: l.state,
    phone: l.phone,
    email: l.email,
    origin: l.origin,
    acquisition_channel: l.acquisitionChannel,
    assigned_consultants_raw: l.assignedConsultantsRaw,
    relationship_start_date: l.relationshipStartDate?.toISOString().slice(0, 10) ?? null,
    last_transaction_at: l.lastTransactionAt?.toISOString() ?? null,
    never_transacted: l.neverTransacted,
  };
}

/** Uma consulta paginada; o diferenciador recebe tudo por argumento. */
async function lerEstadoAtual(): Promise<EstadoAtual> {
  const supabase = await createClient();
  const porContrato = new Map<string, EstabelecimentoExistente>();
  const porCnpjEEndereco = new Map<string, EstabelecimentoExistente>();

  const PAGINA = 1000;
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from("establishments")
      .select(
        "id, external_contract, cnpj, legal_name, trade_name, phone, email, origin, acquisition_channel, assigned_consultants_raw, last_transaction_at, never_transacted, segments(source_name), establishment_addresses(cep, city, state, address_hash, is_current), establishment_capture_points(status, capture_methods(source_name))",
      )
      .eq("is_active", true)
      .range(inicio, inicio + PAGINA - 1);

    if (error) throw new Error(`Falha ao ler o estado atual: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data) {
      const corrente = (r.establishment_addresses ?? []).find((a) => a.is_current);
      const e: EstabelecimentoExistente = {
        id: r.id,
        externalContract: r.external_contract,
        cnpj: r.cnpj,
        addressHash: corrente?.address_hash ?? null,
        legalName: r.legal_name,
        tradeName: r.trade_name,
        cep: corrente?.cep ?? null,
        city: corrente?.city ?? "",
        state: corrente?.state ?? "",
        phone: r.phone,
        email: r.email,
        segmentSourceName: r.segments?.source_name ?? null,
        acquisitionChannel: r.acquisition_channel,
        assignedConsultantsRaw: r.assigned_consultants_raw,
        origin: r.origin,
        lastTransactionAt: r.last_transaction_at,
        neverTransacted: r.never_transacted,
        captureMethodSourceNames: (r.establishment_capture_points ?? [])
          .filter((p) => p.status === "ativo")
          .map((p) => p.capture_methods?.source_name)
          .filter((n): n is string => Boolean(n)),
      };
      if (e.externalContract) porContrato.set(e.externalContract, e);
      if (e.cnpj && e.addressHash) porCnpjEEndereco.set(`${e.cnpj}|${e.addressHash}`, e);
    }

    if (data.length < PAGINA) break;
  }

  return { porContrato, porCnpjEEndereco };
}
