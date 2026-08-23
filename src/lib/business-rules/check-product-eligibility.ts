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

export function eligibleSegmentIds(
  mode: EligibilityMode,
  activeSegmentIds: readonly string[],
  rules: readonly SegmentRule[],
): string[] {
  const byId = new Map(rules.map((r) => [r.segmentId, r.ruleType]));
  return activeSegmentIds.filter((id) => isSegmentEligible(mode, byId.get(id) ?? null));
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
