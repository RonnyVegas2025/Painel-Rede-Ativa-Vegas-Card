import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Parametro operacional vem de system_settings, nunca de literal no componente.
      // Nao da para pegar isso por regra sintatica sem falso positivo (status HTTP 200,
      // por exemplo), entao a verificacao fica na revisao e nos testes.
    },
  },
  // next-env.d.ts e gerado pelo `next build` e ignorado pelo git. Ele carrega uma
  // triple-slash reference que a propria regra do Next reprova, entao o lint
  // passava no CI (que roda antes do build, quando o arquivo nao existe) e
  // falhava na maquina de quem tinha acabado de compilar.
  { ignores: [".next/**", "node_modules/**", "supabase/**", "next-env.d.ts"] },
];

export default config;
