import type { SegmentRuleType } from "./check-product-eligibility";

/**
 * Migrar regra de elegibilidade de um segmento para o canônico, ao mapeá-lo.
 *
 * O banco recusa aliasar segmento com regra pendurada (migration 0026), porque a
 * regra continuaria visível na tela de modalidades e deixaria de valer — quem
 * governa passa a ser o canônico. Antes de mapear, então, cada regra precisa ser
 * migrada ou descartada.
 *
 * A migração pode colidir: `unique (card_product_id, segment_id)` recusa dois
 * vínculos para o mesmo par. São três situações, e confundi-las é o erro caro.
 */
export type RuleMigrationOutcome =
  /** Canônico sem regra para a modalidade: migra direto. */
  | "migrar"
  /**
   * Canônico já tem regra IGUAL. Nada a fazer no canônico; a do alias é
   * descartada e o efeito permanece o mesmo. Informar, não perguntar.
   */
  | "ja_existe"
  /**
   * Canônico tem regra CONTRÁRIA. É conflito de intenção, não de dados: alguém
   * decidiu `allow` num lugar e `deny` no outro, e nenhuma das duas é obviamente
   * certa. **Não escolher pelo operador** — mostrar as duas e perguntar qual
   * prevalece, com a escolha auditada.
   *
   * Raro, e exatamente onde uma migração silenciosa erraria feio.
   */
  | "conflito";

export interface RuleToMigrate {
  cardProductId: string;
  cardProductName: string;
  /** Regra pendurada no segmento que está sendo mapeado. */
  aliasRule: SegmentRuleType;
  /** Regra que o canônico já tem para a mesma modalidade, se houver. */
  canonicalRule: SegmentRuleType | null;
}

export interface RuleMigrationDecision extends RuleToMigrate {
  outcome: RuleMigrationOutcome;
}

export function resolveRuleMigration(rule: RuleToMigrate): RuleMigrationDecision {
  if (rule.canonicalRule === null) return { ...rule, outcome: "migrar" };
  if (rule.canonicalRule === rule.aliasRule) return { ...rule, outcome: "ja_existe" };
  return { ...rule, outcome: "conflito" };
}

export function resolveRuleMigrations(
  rules: readonly RuleToMigrate[],
): RuleMigrationDecision[] {
  return rules.map(resolveRuleMigration);
}

/**
 * O mapeamento só pode ser aplicado quando nenhum conflito de intenção ficou sem
 * decisão. `migrar` e `ja_existe` a aplicação resolve sozinha; `conflito` exige
 * uma escolha explícita de quem opera.
 */
export function hasUnresolvedConflict(
  decisions: readonly RuleMigrationDecision[],
): boolean {
  return decisions.some((d) => d.outcome === "conflito");
}
