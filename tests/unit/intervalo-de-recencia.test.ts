import { describe, expect, it } from "vitest";
import { TRANSACTION_STATUS, type TransactionStatus } from "@/constants/transaction-status";
import { calculateTransactionStatus } from "@/lib/business-rules/calculate-transaction-status";
import { intervaloDeRecencia } from "@/lib/business-rules/intervalo-de-recencia";

const LIMITES = { recentDays: 30, attentionDays: 60, actionDays: 90 };

/**
 * A verificação é de EQUIVALÊNCIA, não de valores escritos à mão.
 *
 * O requisito é que o intervalo selecione exatamente as mesmas linhas que a regra
 * original classificaria naquele status. Uma expectativa escrita à mão provaria
 * apenas que eu acho que a fronteira cai onde acho — que é como o defeito de fuso
 * do E-002 passou na primeira vez.
 */
function dentro(intervalo: ReturnType<typeof intervaloDeRecencia>, t: Date): boolean {
  if (intervalo.apenasNuncaTransacionou) return false;
  if (intervalo.desde !== null && t < intervalo.desde) return false;
  if (intervalo.ate !== null && t >= intervalo.ate) return false;
  return true;
}

const STATUS: readonly TransactionStatus[] = [
  TRANSACTION_STATUS.RECENTE,
  TRANSACTION_STATUS.ATENCAO,
  TRANSACTION_STATUS.ACAO_NECESSARIA,
  TRANSACTION_STATUS.CRITICO,
];

describe("o intervalo seleciona o mesmo que a regra classifica", () => {
  // Vários "agora", incluindo os dois dias de mudança de horário no hemisfério
  // norte — quando São Paulo não muda mas o processo pode estar em outro fuso.
  const AGORAS = [
    "2026-08-25T14:00:00Z",
    "2026-01-01T02:30:00Z",
    "2026-03-08T09:00:00Z",
    "2026-11-01T05:00:00Z",
    "2026-06-15T23:59:59Z",
  ].map((s) => new Date(s));

  it.each(AGORAS.map((a) => [a.toISOString(), a]))(
    "com agora = %s, cada data cai no mesmo balde nos dois caminhos",
    (_rotulo, agora) => {
      const intervalos = new Map(STATUS.map((s) => [s, intervaloDeRecencia(s, LIMITES, agora)]));

      // 400 dias para trás, hora a hora perto das fronteiras.
      const divergentes: string[] = [];
      for (let dias = -3; dias <= 400; dias++) {
        for (const hora of [0, 3, 12, 23]) {
          const t = new Date(agora.getTime() - dias * 86_400_000);
          t.setUTCHours(hora, 30, 0, 0);
          const esperado = calculateTransactionStatus(t, LIMITES, agora);
          const obtidos = STATUS.filter((s) => dentro(intervalos.get(s)!, t));
          if (obtidos.length !== 1 || obtidos[0] !== esperado) {
            divergentes.push(`${t.toISOString()}: regra=${esperado} intervalo=[${obtidos.join(",")}]`);
          }
        }
      }
      expect(divergentes.slice(0, 5)).toEqual([]);
    },
  );

  it("os intervalos não se sobrepõem e não deixam buraco", () => {
    // Um estabelecimento tem de aparecer em EXATAMENTE um filtro. Sobreposição o
    // faria aparecer em dois; buraco o faria sumir de todos — e sumir da lista é
    // indistinguível de não existir.
    const agora = new Date("2026-08-25T14:00:00Z");
    const intervalos = STATUS.map((s) => intervaloDeRecencia(s, LIMITES, agora));
    for (let dias = 0; dias <= 200; dias++) {
      const t = new Date(agora.getTime() - dias * 86_400_000);
      const quantos = intervalos.filter((i) => dentro(i, t)).length;
      expect({ dias, quantos }).toEqual({ dias, quantos: 1 });
    }
  });

  it("nunca transacionou não é uma data", () => {
    const i = intervaloDeRecencia(TRANSACTION_STATUS.NUNCA_TRANSACIONOU, LIMITES);
    expect(i).toEqual({ desde: null, ate: null, apenasNuncaTransacionou: true });
  });

  it("data futura entra em `recente`, como na regra original", () => {
    // Erro de digitação na planilha. A regra original trata como recente; o
    // intervalo tem de concordar com ELA, não com o que seria mais elegante.
    const agora = new Date("2026-08-25T14:00:00Z");
    const amanha = new Date(agora.getTime() + 86_400_000);
    expect(calculateTransactionStatus(amanha, LIMITES, agora)).toBe(TRANSACTION_STATUS.RECENTE);
    expect(dentro(intervaloDeRecencia(TRANSACTION_STATUS.RECENTE, LIMITES, agora), amanha)).toBe(true);
  });

  it("o corte é o início do dia civil, não `agora menos N`", () => {
    // Se fosse "agora − 30 dias", uma transação das 22h do dia do corte cairia num
    // balde à tarde e noutro à noite — e a lista mudaria sozinha ao longo do dia.
    const manha = new Date("2026-08-25T11:00:00Z");
    const noite = new Date("2026-08-25T23:00:00Z");
    const a = intervaloDeRecencia(TRANSACTION_STATUS.RECENTE, LIMITES, manha);
    const b = intervaloDeRecencia(TRANSACTION_STATUS.RECENTE, LIMITES, noite);
    expect(a.desde!.toISOString()).toBe(b.desde!.toISOString());
    expect(a.desde!.toISOString()).toBe("2026-07-26T03:00:00.000Z");
  });
});
