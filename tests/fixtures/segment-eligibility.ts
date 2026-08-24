/**
 * Entradas para a paridade da elegibilidade de segmento (ADR 0003).
 *
 * **Sem valores esperados**, pelo mesmo motivo de `transaction-status.ts`: quem
 * prova que a regra está certa é `tests/unit/product-eligibility.test.ts`; quem
 * prova que as duas implementações concordam é o arnês.
 *
 * Esta função é o caso que justifica o arnês retroativamente. A gêmea TypeScript
 * sempre devolveu booleano (`rule === "allow"`); a SQL devolvia **NULL** para
 * segmento sem regra em modo `allowlist`, porque `p_rule = 'allow'` com nulo é
 * nulo. O defeito atravessou a revisão e só apareceu no pgTAP (B-7). Com as duas
 * implementações comparadas entre si, `{ sql: null, ts: 'false' }` teria saltado
 * no primeiro caso da lista abaixo.
 *
 * O espaço de entrada é pequeno e fechado: três modos por três estados de regra.
 * Está coberto por inteiro — não há razão para amostrar.
 */

export type ModoElegibilidade = "all" | "allowlist" | "denylist";
export type TipoRegra = "allow" | "deny";

export interface EntradaElegibilidade {
  modo: ModoElegibilidade;
  /** `null` = segmento sem regra mapeada para a modalidade. */
  regra: TipoRegra | null;
}

const MODOS: readonly ModoElegibilidade[] = ["all", "allowlist", "denylist"];
const REGRAS: readonly (TipoRegra | null)[] = [null, "allow", "deny"];

export const ENTRADAS_ELEGIBILIDADE: readonly EntradaElegibilidade[] = MODOS.flatMap((modo) =>
  REGRAS.map((regra) => ({ modo, regra })),
);
