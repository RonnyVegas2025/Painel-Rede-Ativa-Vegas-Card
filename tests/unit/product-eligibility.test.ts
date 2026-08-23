import { describe, expect, it } from "vitest";
import {
  eligibleSegmentIds,
  findContradictoryRules,
  isSegmentEligible,
  type SegmentRule,
} from "@/lib/business-rules/check-product-eligibility";

describe("isSegmentEligible", () => {
  describe("modo all", () => {
    it("aceita tudo, inclusive sem regra", () => {
      expect(isSegmentEligible("all", null)).toBe(true);
      expect(isSegmentEligible("all", "allow")).toBe(true);
      expect(isSegmentEligible("all", "deny")).toBe(true);
    });
  });

  describe("modo allowlist", () => {
    it("aceita somente allow", () => {
      expect(isSegmentEligible("allowlist", "allow")).toBe(true);
      expect(isSegmentEligible("allowlist", "deny")).toBe(false);
    });

    it("falha fechada: sem regra e inelegivel", () => {
      // E o que garante "Farmacia nao exibe postos" mesmo com Subgrupo nao mapeado.
      expect(isSegmentEligible("allowlist", null)).toBe(false);
    });
  });

  describe("modo denylist", () => {
    it("aceita tudo menos deny", () => {
      expect(isSegmentEligible("denylist", null)).toBe(true);
      expect(isSegmentEligible("denylist", "allow")).toBe(true);
      expect(isSegmentEligible("denylist", "deny")).toBe(false);
    });
  });
});

describe("eligibleSegmentIds", () => {
  const ativos = ["farmacia", "drogaria", "posto", "padaria"];

  it("Farmacia nao exibe posto — criterio de aceite 1", () => {
    const regras: SegmentRule[] = [
      { segmentId: "farmacia", ruleType: "allow" },
      { segmentId: "drogaria", ruleType: "allow" },
    ];
    const resultado = eligibleSegmentIds("allowlist", ativos, regras);
    expect(resultado).toEqual(["farmacia", "drogaria"]);
    expect(resultado).not.toContain("posto");
  });

  it("Vegas Day aceita toda a rede sem precisar de vinculo", () => {
    expect(eligibleSegmentIds("all", ativos, [])).toEqual(ativos);
  });

  it("denylist remove apenas o que foi negado", () => {
    const regras: SegmentRule[] = [{ segmentId: "posto", ruleType: "deny" }];
    expect(eligibleSegmentIds("denylist", ativos, regras)).toEqual([
      "farmacia", "drogaria", "padaria",
    ]);
  });

  it("segmento novo nao aparece em modalidade restrita ate ser mapeado", () => {
    const comNovo = [...ativos, "segmento-novo-da-planilha"];
    const regras: SegmentRule[] = [{ segmentId: "farmacia", ruleType: "allow" }];
    expect(eligibleSegmentIds("allowlist", comNovo, regras)).toEqual(["farmacia"]);
  });
});

describe("findContradictoryRules", () => {
  it("nao acusa conflito quando as regras sao coerentes", () => {
    expect(
      findContradictoryRules([
        { segmentId: "a", ruleType: "allow" },
        { segmentId: "b", ruleType: "deny" },
      ]),
    ).toEqual([]);
  });

  it("acusa allow e deny para o mesmo segmento", () => {
    // No banco isso e impossivel por unique(card_product_id, segment_id).
    // A funcao existe para avisar antes do INSERT falhar.
    expect(
      findContradictoryRules([
        { segmentId: "a", ruleType: "allow" },
        { segmentId: "a", ruleType: "deny" },
      ]),
    ).toEqual(["a"]);
  });
});
