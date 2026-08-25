import { describe, expect, it } from "vitest";
import {
  avaliarConfirmacao,
  normalizarQuantidade,
} from "@/lib/business-rules/confirmacao-deliberada";

describe("normalizarQuantidade", () => {
  it("aceita com e sem separador: o atrito é sobre ler, não sobre digitar", () => {
    expect(normalizarQuantidade("1412")).toBe(1412);
    expect(normalizarQuantidade("1.412")).toBe(1412);
    expect(normalizarQuantidade(" 1.412 ")).toBe(1412);
  });

  it("entrada sem dígito é ausência, não zero", () => {
    // Devolver 0 faria "abc" bater com uma prévia de zero ausentes.
    expect(normalizarQuantidade("")).toBeNull();
    expect(normalizarQuantidade("abc")).toBeNull();
  });
});

describe("abaixo do limiar", () => {
  it("não pede nada: atrito em todo lugar é atrito em lugar nenhum", () => {
    const e = avaliarConfirmacao({ ausentes: 12, excede: false, digitado: null });
    expect(e).toEqual({ modo: "livre", podeAplicar: true, erro: null });
  });

  it("`excede` manda, não o número: 0 ausentes também é livre", () => {
    expect(avaliarConfirmacao({ ausentes: 0, excede: false, digitado: null }).podeAplicar).toBe(true);
  });
});

describe("acima do limiar", () => {
  const acima = (digitado: string | null) =>
    avaliarConfirmacao({ ausentes: 1412, excede: true, digitado });

  it("campo vazio não pode aplicar, e não acusa erro", () => {
    // Acusar erro antes da tentativa treina a pessoa a ignorar o texto vermelho.
    expect(acima("")).toEqual({ modo: "exige_confirmacao", podeAplicar: false, erro: null });
    expect(acima(null).erro).toBeNull();
  });

  it("número errado diz os dois números, não só que está errado", () => {
    const e = acima("1421");
    expect(e.podeAplicar).toBe(false);
    expect(e.erro).toBe("Você digitou 1.421. A quantidade é 1.412.");
  });

  it("número certo habilita, com ou sem ponto", () => {
    expect(acima("1412").podeAplicar).toBe(true);
    expect(acima("1.412").podeAplicar).toBe(true);
    expect(acima("1.412").erro).toBeNull();
  });

  it("prefixo não passa: 141 não é 1412", () => {
    expect(acima("141").podeAplicar).toBe(false);
  });
});
