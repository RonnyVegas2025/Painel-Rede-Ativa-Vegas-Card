import { describe, expect, it } from "vitest";
import {
  normalizeAddress,
  normalizeCep,
  normalizeCnpj,
  normalizePhone,
  parseBrazilianDate,
} from "@/lib/business-rules/normalize-address";

describe("normalizeCnpj", () => {
  it("aceita 14 digitos com ou sem mascara", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizeCnpj("12345678000195")).toBe("12345678000195");
  });

  it("recusa comprimento errado em vez de truncar", () => {
    expect(normalizeCnpj("123")).toBeNull();
    expect(normalizeCnpj("123456780001950")).toBeNull();
  });
});

describe("normalizeCep", () => {
  it("aceita 8 digitos", () => {
    expect(normalizeCep("01310-100")).toBe("01310100");
  });
  it("recusa incompleto", () => {
    expect(normalizeCep("0131010")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("aceita fixo e celular", () => {
    expect(normalizePhone("(11) 3456-7890")).toBe("1134567890");
    expect(normalizePhone("(11) 98765-4321")).toBe("11987654321");
  });
  it("remove o codigo do pais", () => {
    expect(normalizePhone("+55 11 98765-4321")).toBe("11987654321");
  });
  it("recusa numero curto", () => {
    expect(normalizePhone("98765")).toBeNull();
  });
});

describe("parseBrazilianDate", () => {
  it("le DD/MM/AAAA", () => {
    const d = parseBrazilianDate("15/03/2026");
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(2);
    expect(d?.getUTCDate()).toBe(15);
  });

  it("recusa data inexistente em vez de rolar para marco", () => {
    expect(parseBrazilianDate("31/02/2026")).toBeNull();
  });

  it("recusa formato ISO: a planilha e brasileira", () => {
    expect(parseBrazilianDate("2026-03-15")).toBeNull();
  });

  it("meio-dia UTC mantem o dia em Sao Paulo", () => {
    const d = parseBrazilianDate("15/03/2026");
    const emSP = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d!);
    expect(emSP).toBe("2026-03-15");
  });
});

describe("normalizeAddress", () => {
  it("expande abreviacao e remove acento", () => {
    expect(normalizeAddress("Av. Paulista, 1000")).toBe("avenida paulista 1000");
  });

  it("junta variacoes da mesma rua no mesmo hash", () => {
    const a = normalizeAddress("Av. Paulista, 1000", "01310-100");
    const b = normalizeAddress("AVENIDA PAULISTA 1000", "01310100");
    expect(a).toBe(b);
  });

  it("anexa o CEP quando valido e ignora quando nao", () => {
    expect(normalizeAddress("Rua A, 10", "01310-100")).toContain("01310100");
    expect(normalizeAddress("Rua A, 10", "013")).not.toContain("013");
  });

  it("distingue enderecos realmente diferentes", () => {
    expect(normalizeAddress("Rua A, 10")).not.toBe(normalizeAddress("Rua A, 11"));
  });

  // Regressao: a saida vira hash persistido (ADR 0001). Mudar a normalizacao sem
  // migrar dados faz registros existentes deixarem de casar.
  it.each([
    ["R. das Flores, 25 - Apto 3", "rua das flores 25 apartamento 3"],
    ["Praça da Sé, s/n", "praca da se sn"],
    ["Rod. Anhanguera, km 20", "rodovia anhanguera km 20"],
    ["Jd. Paulistano", "jardim paulistano"],
  ])("congelado: %s", (entrada, esperado) => {
    expect(normalizeAddress(entrada)).toBe(esperado);
  });
});
