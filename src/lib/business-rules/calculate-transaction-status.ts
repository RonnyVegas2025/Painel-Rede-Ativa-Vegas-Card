import {
  TRANSACTION_STATUS,
  type TransactionStatus,
} from "@/constants/transaction-status";

export interface RecencyThresholds {
  recentDays: number;
  attentionDays: number;
  actionDays: number;
}

const TZ = "America/Sao_Paulo";

/**
 * Data civil em Sao Paulo, como numero de dias desde a epoca.
 *
 * Nao usar diferenca de milissegundos dividida por 86_400_000: uma transacao das
 * 22h de ontem viraria "hoje" ou "anteontem" conforme a hora em que a conta roda,
 * e o horario de verao introduz dias de 23 e 25 horas.
 */
function civilDayInSaoPaulo(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return Math.floor(Date.parse(`${parts}T00:00:00Z`) / 86_400_000);
}

export function daysSinceTransaction(
  lastTransactionAt: Date | null,
  now: Date = new Date(),
): number | null {
  if (lastTransactionAt === null) return null;
  return civilDayInSaoPaulo(now) - civilDayInSaoPaulo(lastTransactionAt);
}

/**
 * Gemea da funcao SQL public.calculate_transaction_status.
 * Coberta por teste de paridade: divergir do SQL faz o rotulo da tela contradizer
 * o filtro do mapa.
 *
 * Nao le o banco de proposito. Os limites vem por argumento, carregados uma vez
 * por lib/settings/get-settings.ts.
 */
export function calculateTransactionStatus(
  lastTransactionAt: Date | null,
  thresholds: RecencyThresholds,
  now: Date = new Date(),
): TransactionStatus {
  if (lastTransactionAt === null) return TRANSACTION_STATUS.NUNCA_TRANSACIONOU;

  const days = daysSinceTransaction(lastTransactionAt, now);
  if (days === null) return TRANSACTION_STATUS.NUNCA_TRANSACIONOU;

  // Data futura na base: acontece com erro de digitacao na planilha. Trata como
  // recente e deixa a importacao sinalizar, em vez de classificar como critico.
  if (days < 0) return TRANSACTION_STATUS.RECENTE;

  if (days <= thresholds.recentDays) return TRANSACTION_STATUS.RECENTE;
  if (days <= thresholds.attentionDays) return TRANSACTION_STATUS.ATENCAO;
  if (days <= thresholds.actionDays) return TRANSACTION_STATUS.ACAO_NECESSARIA;
  return TRANSACTION_STATUS.CRITICO;
}
