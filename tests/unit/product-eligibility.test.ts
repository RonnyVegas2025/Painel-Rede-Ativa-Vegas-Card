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
  /** Segmento canonico, sem alias. */
  const canonico = (id: string, isActive = true) => ({
    id,
    isActive,
    canonicalSegmentId: null,
  });
  /** Alias de outro segmento — mantem o proprio source_name no banco. */
  const alias = (id: string, canonicalSegmentId: string, isActive = true) => ({
    id,
    isActive,
    canonicalSegmentId,
  });

  const ativos = ["drogaria", "farmacia", "padaria", "posto"].map((id) => canonico(id));

  it("Farmacia nao exibe posto — criterio de aceite 1", () => {
    const regras: SegmentRule[] = [
      { segmentId: "farmacia", ruleType: "allow" },
      { segmentId: "drogaria", ruleType: "allow" },
    ];
    const resultado = eligibleSegmentIds("allowlist", ativos, regras);
    expect(resultado).toEqual(["drogaria", "farmacia"]);
    expect(resultado).not.toContain("posto");
  });

  it("Vegas Day aceita toda a rede sem precisar de vinculo", () => {
    expect(eligibleSegmentIds("all", ativos, [])).toEqual([
      "drogaria", "farmacia", "padaria", "posto",
    ]);
  });

  it("denylist remove apenas o que foi negado", () => {
    const regras: SegmentRule[] = [{ segmentId: "posto", ruleType: "deny" }];
    expect(eligibleSegmentIds("denylist", ativos, regras)).toEqual([
      "drogaria", "farmacia", "padaria",
    ]);
  });

  it("segmento novo nao aparece em modalidade restrita ate ser mapeado", () => {
    const comNovo = [...ativos, canonico("segmento-novo-da-planilha")];
    const regras: SegmentRule[] = [{ segmentId: "farmacia", ruleType: "allow" }];
    expect(eligibleSegmentIds("allowlist", comNovo, regras)).toEqual(["farmacia"]);
  });

  it("segmento inativo nao entra", () => {
    const comInativo = [...ativos, canonico("descontinuado", false)];
    const regras: SegmentRule[] = [{ segmentId: "descontinuado", ruleType: "allow" }];
    expect(eligibleSegmentIds("allowlist", comInativo, regras)).toEqual([]);
  });

  // --- alias (migration 0023) ------------------------------------------------

  it("alias herda a elegibilidade do canonico", () => {
    // O caso que motivou o alias: a planilha traz "PADARIA E CONFEITARIA" e o
    // negocio ja tem "padaria". Apagar quebraria a reconciliacao; desativar
    // vincularia estabelecimentos a segmento inativo.
    const segmentos = [canonico("padaria"), alias("padaria-e-confeitaria", "padaria")];
    const regras: SegmentRule[] = [{ segmentId: "padaria", ruleType: "allow" }];
    expect(eligibleSegmentIds("allowlist", segmentos, regras)).toEqual([
      "padaria", "padaria-e-confeitaria",
    ]);
  });

  it("regra mapeada ao alias NAO governa: quem governa e o canonico", () => {
    // Consequencia deliberada de mapear. A tela avisa antes de aplicar.
    const segmentos = [canonico("padaria"), alias("padaria-e-confeitaria", "padaria")];
    const regras: SegmentRule[] = [
      { segmentId: "padaria-e-confeitaria", ruleType: "allow" },
    ];
    expect(eligibleSegmentIds("allowlist", segmentos, regras)).toEqual([]);
  });

  it("alias cujo canonico esta inativo nao volta a ser elegivel sozinho", () => {
    const segmentos = [
      canonico("padaria", false),
      alias("padaria-e-confeitaria", "padaria"),
    ];
    const regras: SegmentRule[] = [{ segmentId: "padaria", ruleType: "allow" }];
    expect(eligibleSegmentIds("allowlist", segmentos, regras)).toEqual([]);
  });

  it("alias inativo sai, mesmo com o canonico ativo e permitido", () => {
    const segmentos = [
      canonico("padaria"),
      alias("padaria-e-confeitaria", "padaria", false),
    ];
    const regras: SegmentRule[] = [{ segmentId: "padaria", ruleType: "allow" }];
    expect(eligibleSegmentIds("allowlist", segmentos, regras)).toEqual(["padaria"]);
  });

  it("em denylist, negar o canonico remove tambem os aliases", () => {
    const segmentos = [
      canonico("posto"),
      alias("posto-de-combustivel", "posto"),
      canonico("padaria"),
    ];
    const regras: SegmentRule[] = [{ segmentId: "posto", ruleType: "deny" }];
    expect(eligibleSegmentIds("denylist", segmentos, regras)).toEqual(["padaria"]);
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
