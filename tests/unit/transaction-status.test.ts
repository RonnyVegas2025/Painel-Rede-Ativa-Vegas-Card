import { describe, expect, it } from "vitest";
import {
  calculateTransactionStatus,
  daysSinceTransaction,
  type RecencyThresholds,
} from "@/lib/business-rules/calculate-transaction-status";

const T: RecencyThresholds = { recentDays: 30, attentionDays: 60, actionDays: 90 };
const NOW = new Date("2026-08-02T15:00:00Z");

const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("calculateTransactionStatus", () => {
  it("nunca transacionou quando a data e nula", () => {
    expect(calculateTransactionStatus(null, T, NOW)).toBe("nunca_transacionou");
  });

  it.each([
    [0, "recente"],
    [1, "recente"],
    [29, "recente"],
    [30, "recente"],
    [31, "atencao"],
    [59, "atencao"],
    [60, "atencao"],
    [61, "acao_necessaria"],
    [89, "acao_necessaria"],
    [90, "acao_necessaria"],
    [91, "critico"],
    [400, "critico"],
  ])("%i dias => %s", (dias, esperado) => {
    expect(calculateTransactionStatus(daysAgo(dias), T, NOW)).toBe(esperado);
  });

  it("respeita limites alterados em system_settings", () => {
    const outros: RecencyThresholds = { recentDays: 7, attentionDays: 14, actionDays: 21 };
    expect(calculateTransactionStatus(daysAgo(10), outros, NOW)).toBe("atencao");
    expect(calculateTransactionStatus(daysAgo(10), T, NOW)).toBe("recente");
  });

  it("trata data futura como recente, nao como critico", () => {
    const futuro = new Date(NOW.getTime() + 5 * 86_400_000);
    expect(calculateTransactionStatus(futuro, T, NOW)).toBe("recente");
  });

  describe("fuso America/Sao_Paulo", () => {
    it("22h de ontem em SP conta como 1 dia, nao como 0 ou 2", () => {
      // 2026-08-01 22:00 em SP = 2026-08-02 01:00 UTC.
      // Contando em UTC daria o mesmo dia civil do "agora"; em SP e o dia anterior.
      const ontemNoite = new Date("2026-08-02T01:00:00Z");
      expect(daysSinceTransaction(ontemNoite, NOW)).toBe(1);
    });

    it("madrugada em SP ainda e o mesmo dia civil", () => {
      const hojeMadrugada = new Date("2026-08-02T06:00:00Z"); // 03:00 em SP
      expect(daysSinceTransaction(hojeMadrugada, NOW)).toBe(0);
    });
  });

  it("dias corridos ignoram o horario dentro do dia", () => {
    const manha = new Date("2026-07-03T11:00:00Z");
    const noite = new Date("2026-07-03T23:00:00Z");
    expect(daysSinceTransaction(manha, NOW)).toBe(daysSinceTransaction(noite, NOW));
  });
});
