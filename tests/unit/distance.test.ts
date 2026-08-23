import { describe, expect, it } from "vitest";
import { distanceInMeters, evaluateCheckin } from "@/lib/business-rules/calculate-distance";

const SE = { latitude: -23.5505, longitude: -46.6333 };   // Praca da Se
const PAULISTA = { latitude: -23.5614, longitude: -46.6559 }; // Av. Paulista

describe("distanceInMeters", () => {
  it("mesma coordenada da zero", () => {
    expect(distanceInMeters(SE, SE)).toBe(0);
  });

  it("Se ate Paulista fica em torno de 2,6 km", () => {
    expect(distanceInMeters(SE, PAULISTA)).toBeGreaterThan(2400);
    expect(distanceInMeters(SE, PAULISTA)).toBeLessThan(2800);
  });

  it("e simetrica", () => {
    expect(distanceInMeters(SE, PAULISTA)).toBeCloseTo(distanceInMeters(PAULISTA, SE), 6);
  });

  it("100 m ao norte medem ~100 m", () => {
    const norte = { latitude: SE.latitude + 0.0009, longitude: SE.longitude };
    expect(distanceInMeters(SE, norte)).toBeGreaterThan(95);
    expect(distanceInMeters(SE, norte)).toBeLessThan(105);
  });
});

describe("evaluateCheckin", () => {
  const perto = { latitude: -23.5510, longitude: -46.6333 }; // ~55 m da Se

  it("libera dentro do raio", () => {
    const r = evaluateCheckin(perto, SE, 200, 10);
    expect(r.withinRadius).toBe(true);
    expect(r.requiresException).toBe(false);
  });

  it("exige excecao fora do raio", () => {
    const r = evaluateCheckin(PAULISTA, SE, 200, 10);
    expect(r.withinRadius).toBe(false);
    expect(r.requiresException).toBe(true);
    expect(r.message).toContain("Justifique");
  });

  it("considera a precisao do GPS na margem", () => {
    // 300 m de distancia com precisao de 150 m: o consultor pode estar a 150 m,
    // dentro do raio. Reprovar aqui barraria quem esta dentro da loja.
    const trezentos = { latitude: SE.latitude + 0.0027, longitude: SE.longitude };
    expect(evaluateCheckin(trezentos, SE, 200, 150).withinRadius).toBe(true);
    expect(evaluateCheckin(trezentos, SE, 200, 10).withinRadius).toBe(false);
  });

  it("sinaliza precisao ruim mesmo quando libera", () => {
    const r = evaluateCheckin(perto, SE, 200, 500);
    expect(r.withinRadius).toBe(true);
    expect(r.accuracyPoor).toBe(true);
    expect(r.message).toContain("precisão");
  });

  it("precisao ausente nao vira tolerancia infinita", () => {
    const r = evaluateCheckin(PAULISTA, SE, 200, null);
    expect(r.withinRadius).toBe(false);
  });

  it("respeita raio configurado diferente do padrao", () => {
    const cento = { latitude: SE.latitude + 0.0009, longitude: SE.longitude };
    expect(evaluateCheckin(cento, SE, 50, 0).withinRadius).toBe(false);
    expect(evaluateCheckin(cento, SE, 500, 0).withinRadius).toBe(true);
  });
});
