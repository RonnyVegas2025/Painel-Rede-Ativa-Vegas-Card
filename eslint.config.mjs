import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
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
  { ignores: [".next/**", "node_modules/**", "supabase/**"] },
];
