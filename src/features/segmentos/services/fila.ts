import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  resolveRuleMigrations,
  type RuleMigrationDecision,
  type RuleToMigrate,
} from "@/lib/business-rules/resolve-rule-migration";
import type { SegmentRuleType } from "@/lib/business-rules/check-product-eligibility";

export interface ItemDaFila {
  id: string;
  /** Valor cru da planilha. Nunca é editado: é a chave de reconciliação. */
  sourceName: string;
  normalizedName: string;
  category: string;
  cnaeHint: string | null;
  /** Quantos estabelecimentos ativos esta pendência está escondendo. */
  establishmentsHidden: number;
}

export interface Modalidade {
  id: string;
  name: string;
  eligibilityMode: "all" | "allowlist" | "denylist";
}

export interface CanonicoDisponivel {
  id: string;
  normalizedName: string;
  sourceName: string;
}

/**
 * A fila, ordenada por IMPACTO e não por nome.
 *
 * A falha fechada do ADR 0003 faz segmento não mapeado sumir das modalidades
 * restritas. Sem o número, a tela é uma lista alfabética e a ordem de trabalho é
 * arbitrária — e nesta base a primeira pendência esconde 826 estabelecimentos e a
 * última esconde 1.
 */
export async function listarFila(): Promise<ItemDaFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("segment_normalization_queue")
    .select("id, source_name, normalized_name, category, cnae_hint, establishments_hidden")
    .order("establishments_hidden", { ascending: false })
    .order("source_name", { ascending: true });

  if (error) throw new Error(`Falha ao ler a fila de normalização: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    sourceName: r.source_name as string,
    normalizedName: r.normalized_name as string,
    category: r.category as string,
    cnaeHint: r.cnae_hint as string | null,
    establishmentsHidden: Number(r.establishments_hidden ?? 0),
  }));
}

export async function listarModalidades(): Promise<Modalidade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_products")
    .select("id, name, eligibility_mode")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Falha ao ler as modalidades: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    eligibilityMode: r.eligibility_mode as Modalidade["eligibilityMode"],
  }));
}

/**
 * Candidatos a canônico: segmentos já revisados que **não são alias**.
 *
 * Alias não pode apontar para alias — o banco recusa por FK composta, e oferecer
 * a opção na tela para o banco negar depois seria desenhar a frustração.
 */
export async function listarCanonicosDisponiveis(
  excetoId: string,
): Promise<CanonicoDisponivel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("segments")
    .select("id, normalized_name, source_name")
    .is("canonical_segment_id", null)
    .eq("is_active", true)
    .neq("id", excetoId)
    .order("normalized_name", { ascending: true });

  if (error) throw new Error(`Falha ao ler segmentos canônicos: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    normalizedName: r.normalized_name as string,
    sourceName: r.source_name as string,
  }));
}

/**
 * As regras que impedem mapear este segmento, já classificadas contra o canônico
 * escolhido.
 *
 * Duas leituras, e a segunda é a que a tela precisa para não errar: saber que
 * existe regra não basta, é preciso saber se migrar colide — e, se colidir, se é
 * a mesma decisão (nada a fazer) ou a decisão contrária (perguntar).
 */
export async function listarBloqueadores(
  segmentId: string,
  canonicalId: string | null,
): Promise<RuleMigrationDecision[]> {
  const supabase = await createClient();

  const { data: doAlias, error: erroAlias } = await supabase
    .from("product_segments")
    .select("card_product_id, rule_type, card_products(name)")
    .eq("segment_id", segmentId);

  if (erroAlias) throw new Error(`Falha ao ler as regras do segmento: ${erroAlias.message}`);
  if (!doAlias || doAlias.length === 0) return [];

  let doCanonico: { card_product_id: string; rule_type: SegmentRuleType }[] = [];
  if (canonicalId) {
    const { data, error } = await supabase
      .from("product_segments")
      .select("card_product_id, rule_type")
      .eq("segment_id", canonicalId);
    if (error) throw new Error(`Falha ao ler as regras do canônico: ${error.message}`);
    doCanonico = (data ?? []).map((r) => ({
      card_product_id: r.card_product_id as string,
      rule_type: r.rule_type as SegmentRuleType,
    }));
  }

  const porProduto = new Map(doCanonico.map((r) => [r.card_product_id, r.rule_type]));

  const entradas: RuleToMigrate[] = doAlias.map((r) => {
    const produto = r.card_products as unknown as { name: string } | null;
    return {
      cardProductId: r.card_product_id as string,
      cardProductName: produto?.name ?? "modalidade desconhecida",
      aliasRule: r.rule_type as SegmentRuleType,
      canonicalRule: porProduto.get(r.card_product_id as string) ?? null,
    };
  });

  return resolveRuleMigrations(entradas);
}

/**
 * Regras atuais de TODOS os itens da fila, numa consulta só.
 *
 * Uma consulta por item seria N+1: com os 15 segmentos reais da base ainda
 * passaria despercebido, e passaria a doer no primeiro cliente com uma fila
 * grande — que é justamente quando a tela mais importa.
 */
export async function lerRegrasDaFila(
  segmentIds: readonly string[],
): Promise<Map<string, Record<string, SegmentRuleType>>> {
  const porSegmento = new Map<string, Record<string, SegmentRuleType>>();
  if (segmentIds.length === 0) return porSegmento;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_segments")
    .select("segment_id, card_product_id, rule_type")
    .in("segment_id", [...segmentIds]);

  if (error) throw new Error(`Falha ao ler as regras atuais: ${error.message}`);

  for (const r of data ?? []) {
    const seg = r.segment_id as string;
    const atual = porSegmento.get(seg) ?? {};
    atual[r.card_product_id as string] = r.rule_type as SegmentRuleType;
    porSegmento.set(seg, atual);
  }
  return porSegmento;
}
