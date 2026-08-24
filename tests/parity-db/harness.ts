/**
 * Arnês de paridade entre implementação SQL e TypeScript.
 *
 * É o "Vitest contra banco local" previsto no `PLATFORM-STANDARDS.md` §8.
 *
 * ## O que ele faz, e por que não é o que havia antes
 *
 * A mesma entrada vai para as duas implementações e **as saídas são comparadas
 * entre si**. Não há valor esperado no meio.
 *
 * O desenho anterior tinha duas listas de casos, uma em Vitest e outra em pgTAP,
 * cada uma comparando com expectativas escritas à mão, e uma asserção de "mesma
 * quantidade de casos" para amarrá-las. Isso é proxy fraco com aparência de
 * garantia: contar casos não compara resultado, e se a expectativa estivesse
 * errada nos dois arquivos ambos ficariam verdes. Foi o que aconteceu — o teste
 * pgTAP das bordas acusava `calculate_transaction_status` por um erro que estava
 * na construção da própria entrada do teste.
 *
 * Paridade prova que as duas concordam. Não prova que estão certas: isso é papel
 * dos testes de valor esperado sobre a função TypeScript, em `tests/unit/`. As
 * duas verificações são necessárias e nenhuma cobre a outra.
 *
 * ## Por que genérico
 *
 * O ADR 0001 define que o hash do endereço normalizado é **persistido** como
 * chave de identidade do ponto credenciado. A Sprint 1 vai precisar de uma gêmea
 * SQL de `normalizeAddress`, e divergência de um hífen entre as duas duplica
 * pontos na importação — sem erro aparecer, e sem conserto que não passe por
 * migração de dados, porque o hash já estará gravado.
 *
 * Este arnês não sabe nada sobre recência. Para trazer `normalize_address` basta
 * uma definição nova e um arquivo de entradas; nada aqui muda.
 */
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL_BANCO =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Contexto compartilhado pelas duas implementações na mesma execução. */
export interface ContextoParidade {
  /**
   * `now()` lido do banco. As duas implementações precisam do MESMO instante de
   * referência: a função SQL usa o relógio do servidor, e a TypeScript recebe o
   * instante por argumento. Ler o relógio local em vez deste valor introduziria
   * uma divergência do próprio arnês.
   */
  agora: Date;
}

export interface DefinicaoParidade<E> {
  /** Nome legível, usado no título da suíte. */
  nome: string;
  /** Função SQL a exercitar, sem o schema. Ex.: `calculate_transaction_status`. */
  funcaoSql: string;
  /** Argumentos posicionais da chamada SQL, na ordem da assinatura. */
  argumentosSql: (entrada: E, ctx: ContextoParidade) => readonly unknown[];
  /** Implementação TypeScript, chamada com a mesma entrada. */
  funcaoTs: (entrada: E, ctx: ContextoParidade) => unknown;
  /** Rótulo do caso, para a saída do runner apontar a entrada que divergiu. */
  rotulo: (entrada: E) => string;
}

/**
 * Normalização para comparar valores que vêm por caminhos diferentes.
 *
 * O lado SQL chega como texto, porque a consulta faz `::text` — é o que torna
 * enum, booleano, número e texto comparáveis sem o arnês conhecer o tipo de
 * retorno de cada função. O lado TypeScript passa pela mesma conversão.
 *
 * `null` é preservado: `null` e a string "null" são resultados diferentes, e
 * achatar os dois esconderia justamente o tipo de divergência que interessa.
 */
function normalizar(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

export function verificarParidade<E>(
  definicao: DefinicaoParidade<E>,
  entradas: readonly E[],
): void {
  describe(`paridade SQL x TypeScript — ${definicao.nome}`, () => {
    let cliente: Client;
    let ctx: ContextoParidade;

    beforeAll(async () => {
      cliente = new Client({ connectionString: URL_BANCO });
      try {
        await cliente.connect();
      } catch (erro) {
        // Falha, não pula. Um arnês de paridade que se ignora em silêncio quando
        // o banco não responde daria verde justamente na situação em que não
        // verificou nada — que é o defeito que ele existe para eliminar.
        throw new Error(
          `Paridade exige o banco local no ar (${URL_BANCO}). ` +
            `Rode 'supabase start' antes de 'npm run test:parity'. Causa: ${String(erro)}`,
        );
      }
      const { rows } = await cliente.query<{ agora: Date }>("select now() as agora");
      ctx = { agora: rows[0]!.agora };
    });

    afterAll(async () => {
      await cliente?.end();
    });

    it("a lista de entradas não está vazia", () => {
      // Sem isto, apagar as fixtures deixaria a suíte verde sem exercitar nada.
      expect(entradas.length).toBeGreaterThan(0);
    });

    it.each(entradas.map((e) => [definicao.rotulo(e), e] as const))(
      "%s",
      async (_rotulo, entrada) => {
        const argumentos = definicao.argumentosSql(entrada, ctx);
        const marcadores = argumentos.map((_, i) => `$${i + 1}`).join(", ");

        const { rows } = await cliente.query<{ resultado: string | null }>(
          `select (public.${definicao.funcaoSql}(${marcadores}))::text as resultado`,
          [...argumentos],
        );

        const doSql = normalizar(rows[0]?.resultado);
        const doTs = normalizar(definicao.funcaoTs(entrada, ctx));

        expect({ sql: doSql, ts: doTs }).toEqual({ sql: doTs, ts: doTs });
      },
    );
  });
}
