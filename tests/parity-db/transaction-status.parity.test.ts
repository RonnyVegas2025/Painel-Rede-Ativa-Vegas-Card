/**
 * Paridade da classificação transacional (risco T1).
 *
 * O filtro do mapa roda em SQL; o rótulo da tela roda em TypeScript. Divergir
 * significa a lista dizer "crítico" e o mapa não trazer o ponto no filtro de
 * críticos, sem erro nenhum aparecer.
 */
import { calculateTransactionStatus } from "@/lib/business-rules/calculate-transaction-status";
import { ENTRADAS_RECENCIA, type EntradaRecencia } from "../fixtures/transaction-status";
import { verificarParidade, type ContextoParidade } from "./harness";

/**
 * Instante da transação, a partir do dia civil de São Paulo.
 *
 * O dia civil é a unidade da regra: uma transação das 22h de ontem não pode
 * virar "hoje" conforme o fuso do servidor. Por isso a data é construída em
 * São Paulo e convertida para o instante correspondente — construir um `date`
 * solto e deixar o Postgres interpretá-lo no fuso do servidor é o erro que
 * fazia o teste pgTAP medir 31 dias onde escrevia 30.
 */
function instanteDaTransacao(diasAtras: number | null, agora: Date): Date | null {
  if (diasAtras === null) return null;

  const diaCivil = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);

  // Meio-dia de São Paulo (15h UTC): longe das duas bordas do dia, então nem
  // arredondamento nem horário de verão movem o resultado de um dia.
  const meioDia = Date.parse(`${diaCivil}T15:00:00Z`);
  return new Date(meioDia - diasAtras * 86_400_000);
}

verificarParidade<EntradaRecencia>(
  {
    nome: "calculate_transaction_status",
    funcaoSql: "calculate_transaction_status",
    argumentosSql: (entrada, ctx: ContextoParidade) => [
      instanteDaTransacao(entrada.diasAtras, ctx.agora),
      entrada.limites.recentDays,
      entrada.limites.attentionDays,
      entrada.limites.actionDays,
    ],
    funcaoTs: (entrada, ctx: ContextoParidade) =>
      calculateTransactionStatus(
        instanteDaTransacao(entrada.diasAtras, ctx.agora),
        entrada.limites,
        ctx.agora,
      ),
    rotulo: (e) =>
      `${e.diasAtras === null ? "sem transacao" : `${e.diasAtras} dias`} ` +
      `sob ${e.limites.recentDays}/${e.limites.attentionDays}/${e.limites.actionDays}`,
  },
  ENTRADAS_RECENCIA,
);
