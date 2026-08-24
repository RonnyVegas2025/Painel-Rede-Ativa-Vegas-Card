import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/parity-db exige o banco local no ar e roda por vitest.parity.config.ts,
    // no job `banco` do CI. Se entrasse aqui, quebraria o job `aplicacao`, que
    // nao sobe infraestrutura.
    exclude: ["node_modules/**", "tests/parity-db/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Ver tests/stubs/server-only.ts: a garantia do pacote e de BUNDLE, e o
      // teste nao monta bundle. `next build` continua exigindo o real.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
