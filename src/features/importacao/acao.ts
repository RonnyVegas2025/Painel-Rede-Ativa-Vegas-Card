/**
 * O estado das ações da importação.
 *
 * Vive fora de `actions.ts` porque um arquivo `"use server"` só pode exportar
 * funções assíncronas — exportar a constante dali faz o módulo inteiro falhar
 * em execução.
 *
 * `next build` NÃO pega isso: o erro só aparece quando a rota é renderizada.
 * Foi o navegador que encontrou, não o typecheck nem o build.
 */
export interface AcaoState {
  error: string | null;
  ok: boolean;
}

export const VAZIO: AcaoState = { error: null, ok: false };
