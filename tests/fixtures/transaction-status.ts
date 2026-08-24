/**
 * Entradas para a verificação de paridade da classificação transacional.
 *
 * **Este arquivo não contém valor esperado, de propósito.**
 *
 * Valor esperado escrito aqui reintroduziria o defeito que o arnês existe para
 * eliminar: as duas metades comparariam com a mesma expectativa em vez de uma com
 * a outra, e um erro de regra cometido nos dois lados ficaria verde.
 *
 * Quem prova que a regra está *certa* é `tests/unit/transaction-status.test.ts`,
 * que exercita a implementação TypeScript contra valores esperados. Quem prova
 * que as duas implementações *concordam* é o arnês. As duas coisas são
 * necessárias e nenhuma substitui a outra.
 */

export interface LimitesRecencia {
  recentDays: number;
  attentionDays: number;
  actionDays: number;
}

export interface EntradaRecencia {
  /** Dias civis antes de hoje. `null` = nunca transacionou. Negativo = data futura. */
  diasAtras: number | null;
  limites: LimitesRecencia;
}

const PADRAO: LimitesRecencia = { recentDays: 30, attentionDays: 60, actionDays: 90 };
const CURTO: LimitesRecencia = { recentDays: 7, attentionDays: 14, actionDays: 21 };

export const ENTRADAS_RECENCIA: readonly EntradaRecencia[] = [
  // Bordas de cada faixa, e o dia seguinte a cada uma. É onde `<` e `<=` divergem,
  // e foi exatamente ali que o teste pgTAP anterior acusava a função errada.
  { diasAtras: 0, limites: PADRAO },
  { diasAtras: 1, limites: PADRAO },
  { diasAtras: 29, limites: PADRAO },
  { diasAtras: 30, limites: PADRAO },
  { diasAtras: 31, limites: PADRAO },
  { diasAtras: 59, limites: PADRAO },
  { diasAtras: 60, limites: PADRAO },
  { diasAtras: 61, limites: PADRAO },
  { diasAtras: 89, limites: PADRAO },
  { diasAtras: 90, limites: PADRAO },
  { diasAtras: 91, limites: PADRAO },
  { diasAtras: 400, limites: PADRAO },

  // Ausência de transação.
  { diasAtras: null, limites: PADRAO },

  // Data futura: acontece com erro de digitação na planilha importada.
  { diasAtras: -1, limites: PADRAO },
  { diasAtras: -5, limites: PADRAO },

  // Os mesmos dias sob limites diferentes: o parâmetro vem de system_settings e
  // muda a classificação do mesmo dado. Se um dos lados ignorar o argumento e ler
  // o banco por conta própria, some a divergência aqui.
  { diasAtras: 10, limites: CURTO },
  { diasAtras: 10, limites: PADRAO },
  { diasAtras: 21, limites: CURTO },
  { diasAtras: 22, limites: CURTO },
  { diasAtras: 7, limites: CURTO },
  { diasAtras: 8, limites: CURTO },
];
