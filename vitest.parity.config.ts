import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Configuração separada para o arnês de paridade, que **exige o banco local no
 * ar**. Fica fora do `npm run test` de propósito:
 *
 * - `npm run test` roda sem infraestrutura, e é o que o job `aplicacao` do CI
 *   executa. Misturar as duas coisas quebraria aquele job.
 * - O arnês roda no job `banco`, que já sobe o stack para o pgTAP.
 *
 * A alternativa — um único comando que pula a paridade quando o banco não
 * responde — foi descartada: daria verde exatamente na situação em que nada foi
 * verificado, que é a forma de falha que este arnês existe para eliminar.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/parity-db/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
