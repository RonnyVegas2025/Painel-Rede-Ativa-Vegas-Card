export type EligibilityMode = "all" | "allowlist" | "denylist";
export type SegmentRuleType = "allow" | "deny";

/**
 * Gemea da funcao SQL public.is_segment_eligible (ADR 0003).
 *
 * Falha fechada: em allowlist, segmento sem regra e inelegivel. E o que garante o
 * criterio de aceite "Farmacia nao exibe postos" mesmo com o mapeamento de
 * Subgrupo incompleto.
 */
export function isSegmentEligible(
  mode: EligibilityMode,
  rule: SegmentRuleType | null,
): boolean {
  switch (mode) {
    case "all":
      return true;
    case "allowlist":
      return rule === "allow";
    case "denylist":
      return rule !== "deny";
  }
}

export interface SegmentRule {
  segmentId: string;
  ruleType: SegmentRuleType;
}

/**
 * Segmento como a regra precisa ve-lo: com o vinculo de alias, nao so o id.
 */
export interface SegmentForEligibility {
  id: string;
  isActive: boolean;
  /** Preenchido quando este segmento e ALIAS de outro (migration 0023). */
  canonicalSegmentId: string | null;
}

/**
 * Gemea da funcao SQL public.eligible_segment_ids.
 *
 * Regra em uma frase: um segmento e elegivel quando ele esta ativo, seu canonico
 * esta ativo, e a regra mapeada AO CANONICO passa em isSegmentEligible.
 *
 * O alias existe porque `source_name` e a chave de reconciliacao da importacao:
 * mapear `PADARIA E CONFEITARIA` para `Padaria` nao pode apagar nem desativar o
 * duplicado, senao a importacao seguinte o recria ou passa a vincular
 * estabelecimentos a segmento inativo (migration 0023).
 *
 * Consequencia deliberada: regra mapeada a um segmento que depois virou alias
 * deixa de governar — quem governa e o canonico. E o proposito do alias.
 *
 * Devolve os ids ORDENADOS. Ordem estavel e o que torna o resultado comparavel
 * com a gemea SQL pelo arnes de paridade.
 */
export function eligibleSegmentIds(
  mode: EligibilityMode,
  segments: readonly SegmentForEligibility[],
  rules: readonly SegmentRule[],
): string[] {
  const ruleByCanonical = new Map(rules.map((r) => [r.segmentId, r.ruleType]));
  const activeById = new Map(segments.map((s) => [s.id, s.isActive]));

  return segments
    .filter((segment) => {
      if (!segment.isActive) return false;

      const canonicalId = segment.canonicalSegmentId ?? segment.id;
      // Alias cujo canonico saiu de circulacao nao volta a ser elegivel sozinho.
      if (activeById.get(canonicalId) !== true) return false;

      return isSegmentEligible(mode, ruleByCanonical.get(canonicalId) ?? null);
    })
    .map((segment) => segment.id)
    .sort();
}

/**
 * A contradicao e impossivel no banco por unique(card_product_id, segment_id).
 * Esta funcao existe para a interface de administracao avisar antes do INSERT
 * falhar, e para o importador validar um lote.
 */
export function findContradictoryRules(rules: readonly SegmentRule[]): string[] {
  const seen = new Map<string, SegmentRuleType>();
  const conflicts: string[] = [];
  for (const rule of rules) {
    const previous = seen.get(rule.segmentId);
    if (previous !== undefined && previous !== rule.ruleType) {
      conflicts.push(rule.segmentId);
    } else {
      seen.set(rule.segmentId, rule.ruleType);
    }
  }
  return conflicts;
}
