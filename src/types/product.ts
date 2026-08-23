import type { EligibilityMode } from "@/lib/business-rules/check-product-eligibility";

export interface CardProduct {
  id: string;
  name: string;
  slug: string;
  eligibilityMode: EligibilityMode;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
}
