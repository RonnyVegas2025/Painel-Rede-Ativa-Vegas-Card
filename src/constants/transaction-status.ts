import type { BadgeTone } from "./badge-tones";

/** Valores da dimensão transacional. A regra que os calcula está em business-rules. */
export const TRANSACTION_STATUS = {
  RECENTE: "recente",
  ATENCAO: "atencao",
  ACAO_NECESSARIA: "acao_necessaria",
  CRITICO: "critico",
  NUNCA_TRANSACIONOU: "nunca_transacionou",
} as const;

export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  recente: "Recente",
  atencao: "Atenção",
  acao_necessaria: "Ação necessária",
  critico: "Crítico",
  nunca_transacionou: "Nunca transacionou",
};

/** Badge: escala semântica do UI Standard §14. */
export const TRANSACTION_STATUS_TONES: Record<TransactionStatus, BadgeTone> = {
  recente: "success",
  atencao: "warning",
  acao_necessaria: "partial",
  critico: "danger",
  nunca_transacionou: "neutral",
};

/**
 * Marcador de mapa: rampa operacional própria, permitida pelo §26.
 * Os pares do §14 são para badge sobre superfície clara; um marcador de 12 px
 * precisa de preenchimento saturado, legível sob sol.
 */
export const TRANSACTION_STATUS_TOKENS: Record<TransactionStatus, string> = {
  recente: "--vg-status-recente",
  atencao: "--vg-status-atencao",
  acao_necessaria: "--vg-status-acao",
  critico: "--vg-status-critico",
  nunca_transacionou: "--vg-status-nunca",
};

/** Cor nunca é o único canal: o marcador leva também ícone e anel (§17 e §20). */
export const TRANSACTION_STATUS_ICONS: Record<TransactionStatus, string> = {
  recente: "circulo-cheio",
  atencao: "circulo-meio",
  acao_necessaria: "triangulo",
  critico: "losango",
  nunca_transacionou: "circulo-vazio",
};
