import type { SegmentRuleType } from "@/lib/business-rules/check-product-eligibility";

export type SegmentCategory =
  | "alimentacao" | "combustivel" | "farmacia" | "refeicao" | "servicos" | "outros";

export interface Segment {
  id: string;
  sourceName: string;
  normalizedName: string;
  category: SegmentCategory;
  cnaeHint: string | null;
  isActive: boolean;
}

export interface ProductSegment {
  id: string;
  cardProductId: string;
  segmentId: string;
  ruleType: SegmentRuleType;
  createdBy: string | null;
}
