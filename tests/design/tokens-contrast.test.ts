import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contraste dos tokens, conforme UI Standard §20:
 *   AA (4,5:1) para texto e 3:1 para limite de componente interativo.
 *
 * Lê styles/tokens.css direto — não uma cópia. Alterar um token sem verificar
 * contraste quebra a suíte, que é o ponto: contraste abaixo do mínimo é bug,
 * não preferência estética.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
  "utf8",
);

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
  if (!match?.[1]) throw new Error(`Token --${name} não encontrado em tokens.css`);
  return match[1];
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA = 4.5;
const UI = 3;

describe("texto sobre superfície", () => {
  it.each([
    ["ink sobre surface", "vg-ink", "vg-surface", AA],
    ["ink sobre background", "vg-ink", "vg-background", AA],
    ["ink-secondary sobre surface", "vg-ink-secondary", "vg-surface", AA],
    ["ink-secondary sobre background", "vg-ink-secondary", "vg-background", AA],
    ["ink-secondary sobre surface-muted", "vg-ink-secondary", "vg-surface-muted", AA],
    ["brand-500 sobre surface", "vg-brand-500", "vg-surface", AA],
    ["brand-700 sobre brand-50", "vg-brand-700", "vg-brand-50", AA],
  ])("%s atinge AA", (_nome, fg, bg, minimo) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(minimo);
  });
});

describe("texto sobre marca", () => {
  it("branco sobre brand-500 atinge AA", () => {
    expect(contrast(token("vg-ink-on-brand"), token("vg-brand-500"))).toBeGreaterThanOrEqual(AA);
  });
  it("branco sobre brand-700 atinge AA", () => {
    expect(contrast(token("vg-ink-on-brand"), token("vg-brand-700"))).toBeGreaterThanOrEqual(AA);
  });
  it("apoio sobre brand-700 atinge AA", () => {
    // Painel institucional do login. Falhar aqui deixa o texto de
    // confidencialidade ilegível justamente na tela de entrada.
    expect(
      contrast(token("vg-ink-on-brand-secondary"), token("vg-brand-700")),
    ).toBeGreaterThanOrEqual(AA);
  });
});

describe("limite de componente interativo — 3:1", () => {
  it("border-field sobre surface", () => {
    // Era o defeito da Sprint 0: o token anterior media 1,64:1.
    expect(contrast(token("vg-border-field"), token("vg-surface"))).toBeGreaterThanOrEqual(UI);
  });
  it("border-field sobre background", () => {
    expect(contrast(token("vg-border-field"), token("vg-background"))).toBeGreaterThanOrEqual(UI);
  });
});

describe("pares semânticos do §14", () => {
  it.each([
    ["success", "vg-success-fg", "vg-success-bg"],
    ["warning", "vg-warning-fg", "vg-warning-bg"],
    ["danger", "vg-danger-fg", "vg-danger-bg"],
    ["info", "vg-info-fg", "vg-info-bg"],
    ["neutral", "vg-neutral-fg", "vg-neutral-bg"],
    ["partial", "vg-partial-fg", "vg-partial-bg"],
    ["suspended", "vg-suspended-fg", "vg-suspended-bg"],
  ])("%s atinge AA sobre o próprio fundo", (_nome, fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["danger", "vg-danger-fg"],
    ["success", "vg-success-fg"],
  ])("%s como fundo de botão mantém o texto branco legível", (_nome, fg) => {
    expect(contrast(token("vg-ink-on-brand"), token(fg))).toBeGreaterThanOrEqual(AA);
  });
});

describe("marca não se confunde com status", () => {
  it("reservado é distinguível da marca por matiz, não só por luminância", () => {
    // O par Informação do §14 (#434B8F) fica a ~1,2:1 do Brand 500: como badge
    // funciona, como preenchimento de marcador ao lado da navegação, não.
    // Por isso reservado é ciano — matiz diferente resolve em 12 px sob sol.
    const reservado = token("vg-status-reservado");
    const brand = token("vg-brand-500");
    const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const azulMenosVermelho = (hex: string) => canal(hex, 2) - canal(hex, 0);
    expect(azulMenosVermelho(reservado)).toBeGreaterThan(azulMenosVermelho(brand) + 60);
  });

  it("nenhuma cor da rampa operacional é a cor da marca", () => {
    const brand = token("vg-brand-500").toLowerCase();
    const rampa = [
      "vg-status-recente", "vg-status-atencao", "vg-status-acao", "vg-status-critico",
      "vg-status-nunca", "vg-status-reservado", "vg-status-pendencia", "vg-status-bloqueado",
    ].map((t) => token(t).toLowerCase());
    expect(rampa).not.toContain(brand);
  });
});
