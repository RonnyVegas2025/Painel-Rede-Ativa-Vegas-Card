/**
 * Tons semânticos do UI Standard §14.
 *
 * Vivem em constants, não no componente Badge: `constants` é a camada mais
 * baixa e não pode importar de `components` — regra de dependência do
 * PLATFORM-STANDARDS.md §3. O componente importa daqui, nunca o contrário.
 */
export const BADGE_TONES = [
  "success", "warning", "danger", "info", "neutral", "partial", "suspended",
] as const;

export type BadgeTone = (typeof BADGE_TONES)[number];
