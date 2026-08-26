import { TRANSACTION_STATUS, type TransactionStatus } from "@/constants/transaction-status";
import type { RecencyThresholds } from "./calculate-transaction-status";

/**
 * O INVERSO de `calculateTransactionStatus`: dado o status, o intervalo de datas.
 *
 * ## Por que isto existe
 *
 * `calculate_transaction_status` é `STABLE` e lê `system_settings` — então **não é
 * indexável**. Filtrar "críticos" calculando o status de cada linha e descartando
 * o resto faz varredura completa a cada troca de filtro.
 *
 * Com 1.804 linhas as duas formas funcionam e ninguém percebe. Com 20 mil, a
 * primeira degrada — e o sintoma aparece longe da causa, meses depois, quando
 * ninguém liga a lentidão da lista à forma como o filtro foi escrito.
 *
 * `last_transaction_at` É indexado. Comparar contra a data derivada dos limites dá
 * o mesmo resultado e usa o índice.
 *
 * ## A fronteira
 *
 * `days` conta **dias civis em São Paulo**, não milissegundos divididos por 86,4
 * milhões: uma transação das 22h de ontem viraria "hoje" ou "anteontem" conforme a
 * hora em que a conta roda. Então o corte não é "agora menos N dias" — é o
 * **início do dia civil** `(hoje − N)` em São Paulo.
 *
 * A equivalência é verificada por propriedade contra a regra original, e não por
 * valores escritos à mão: as duas responderem a mesma coisa é o requisito, e
 * expectativa escrita à mão só provaria que eu acho que sim.
 */

const TZ = "America/Sao_Paulo";

/** Deslocamento de São Paulo, em ms, no instante dado. Negativo (atrás de UTC). */
function deslocamento(instante: number): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(instante));
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return comoUtc - instante;
}

function diaCivil(d: Date): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return Math.floor(Date.parse(`${partes}T00:00:00Z`) / 86_400_000);
}

/**
 * Instante UTC do começo do dia civil `dia` em São Paulo.
 *
 * Duas passadas: o deslocamento é medido no instante candidato, e o instante
 * corrigido pode cair do outro lado de uma mudança de horário. Sem a segunda
 * passada, a fronteira erra em uma hora dois dias por ano — e um estabelecimento
 * mudaria de faixa por causa disso.
 */
function inicioDoDiaCivil(dia: number): Date {
  const candidato = dia * 86_400_000;
  let instante = candidato - deslocamento(candidato);
  instante = candidato - deslocamento(instante);
  return new Date(instante);
}

export interface IntervaloDeRecencia {
  /** `last_transaction_at >= desde`. Nulo quando não há piso. */
  desde: Date | null;
  /** `last_transaction_at < ate`. Nulo quando não há teto. */
  ate: Date | null;
  /** Quando verdadeiro, o filtro é `never_transacted`, não uma data. */
  apenasNuncaTransacionou: boolean;
}

/**
 * O intervalo de `last_transaction_at` que corresponde ao status.
 *
 * `recente` não tem teto de propósito: data futura na base — erro de digitação na
 * planilha — é tratada como recente pela regra original, e o intervalo tem de
 * concordar com ela, não com o que seria mais elegante.
 */
export function intervaloDeRecencia(
  status: TransactionStatus,
  limites: RecencyThresholds,
  agora: Date = new Date(),
): IntervaloDeRecencia {
  const hoje = diaCivil(agora);
  const corte = (n: number) => inicioDoDiaCivil(hoje - n);

  switch (status) {
    case TRANSACTION_STATUS.NUNCA_TRANSACIONOU:
      return { desde: null, ate: null, apenasNuncaTransacionou: true };
    case TRANSACTION_STATUS.RECENTE:
      return { desde: corte(limites.recentDays), ate: null, apenasNuncaTransacionou: false };
    case TRANSACTION_STATUS.ATENCAO:
      return {
        desde: corte(limites.attentionDays),
        ate: corte(limites.recentDays),
        apenasNuncaTransacionou: false,
      };
    case TRANSACTION_STATUS.ACAO_NECESSARIA:
      return {
        desde: corte(limites.actionDays),
        ate: corte(limites.attentionDays),
        apenasNuncaTransacionou: false,
      };
    case TRANSACTION_STATUS.CRITICO:
      return { desde: null, ate: corte(limites.actionDays), apenasNuncaTransacionou: false };
  }
}

/**
 * Ordenar por "dias sem transação" é ordenar por `last_transaction_at`.
 *
 * Mais dias sem transação = data mais antiga. Ordenar pelo derivado obrigaria a
 * calculá-lo para toda a tabela antes de ordenar; a data está indexada.
 *
 * `nulls` decide onde fica quem nunca transacionou: no fim, sempre. Em ordem
 * crescente de data eles seriam os "mais antigos" e encabeçariam a lista de
 * críticos — e nunca ter transacionado é uma condição diferente de ter parado.
 */
export const ORDENACAO_POR_RECENCIA = {
  coluna: "last_transaction_at",
  maisAntigosPrimeiro: { ascending: true, nullsFirst: false },
  maisRecentesPrimeiro: { ascending: false, nullsFirst: false },
} as const;
