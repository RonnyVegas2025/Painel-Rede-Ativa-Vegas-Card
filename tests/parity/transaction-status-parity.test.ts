import { describe, expect, it } from "vitest";
import {
  calculateTransactionStatus,
  type RecencyThresholds,
} from "@/lib/business-rules/calculate-transaction-status";

/**
 * Paridade SQL x TypeScript (risco T1).
 *
 * O filtro do mapa roda em SQL; o rotulo da tela roda em TypeScript. Divergir
 * significa a lista dizer "critico" e o mapa nao trazer o ponto no filtro de
 * criticos, sem erro nenhum aparecer.
 *
 * Estes casos sao os MESMOS de supabase/tests/04_transaction_status_parity.sql.
 * Alterar um lado sem o outro tem de quebrar a suite.
 */
interface ParityCase {
  days: number | null;
  thresholds: RecencyThresholds;
  expected: string;
}

const PADRAO: RecencyThresholds = { recentDays: 30, attentionDays: 60, actionDays: 90 };
const CURTO: RecencyThresholds = { recentDays: 7, attentionDays: 14, actionDays: 21 };

export const PARITY_CASES: readonly ParityCase[] = [
  { days: 0, thresholds: PADRAO, expected: "recente" },
  { days: 30, thresholds: PADRAO, expected: "recente" },
  { days: 31, thresholds: PADRAO, expected: "atencao" },
  { days: 60, thresholds: PADRAO, expected: "atencao" },
  { days: 61, thresholds: PADRAO, expected: "acao_necessaria" },
  { days: 90, thresholds: PADRAO, expected: "acao_necessaria" },
  { days: 91, thresholds: PADRAO, expected: "critico" },
  { days: 400, thresholds: PADRAO, expected: "critico" },
  { days: null, thresholds: PADRAO, expected: "nunca_transacionou" },
  { days: 10, thresholds: CURTO, expected: "atencao" },
  { days: 10, thresholds: PADRAO, expected: "recente" },
  { days: -5, thresholds: PADRAO, expected: "recente" },
];

const NOW = new Date("2026-08-02T15:00:00Z");

describe("paridade da classificacao transacional", () => {
  it.each(PARITY_CASES)(
    "$days dias com $thresholds.recentDays/$thresholds.attentionDays/$thresholds.actionDays => $expected",
    ({ days, thresholds, expected }) => {
      const date = days === null ? null : new Date(NOW.getTime() - days * 86_400_000);
      expect(calculateTransactionStatus(date, thresholds, NOW)).toBe(expected);
    },
  );

  it("cobre as tres bordas de cada faixa", () => {
    const dias = PARITY_CASES.map((c) => c.days);
    for (const borda of [30, 31, 60, 61, 90, 91]) {
      expect(dias).toContain(borda);
    }
  });

  it("tem a mesma quantidade de casos do arquivo pgTAP", () => {
    // O plano do 04_transaction_status_parity.sql e 12. Divergir aqui indica que
    // alguem adicionou caso de um lado so.
    expect(PARITY_CASES).toHaveLength(12);
  });
});
