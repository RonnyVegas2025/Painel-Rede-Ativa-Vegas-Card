import type { ImportRowStatus } from "./classify-import-row";
import type { LinhaNormalizada } from "./normalize-linha-importacao";

/**
 * O que a prévia grava em `import_jobs`, e o que a tela mostra ao operador antes
 * de ele clicar em confirmar.
 *
 * Existe como regra pura, e não dentro da tela, por um motivo específico: os
 * defeitos da origem — meio de captura repetido, endereço sem número — só
 * aparecem no relatório se alguém lembrar de contá-los. Contagem que depende de
 * a tela lembrar é contagem que some no primeiro caminho novo de importação.
 */
export interface ResumoDaImportacao {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  conflictCount: number;
  missingCount: number;
  /** Linhas cujo `Terminal` repetia o mesmo meio. Deduplicado, mas reportado. */
  duplicatedCaptureMethods: number;
  /** Endereços com `N.º: 0`: o fallback de identidade fica fraco neles. */
  addressesWithoutNumber: number;
  /** Acima do limiar de ausentes — exige decisão explícita antes de aplicar. */
  requiresConfirmation: boolean;
  /** Percentual de ausentes sobre o escopo, para a tela dizer o quanto. */
  missingPercent: number;
}

export interface EntradaDoResumo {
  linha: LinhaNormalizada;
  status: ImportRowStatus;
}

/**
 * Resume a prévia.
 *
 * `noEscopo` é quantos estabelecimentos ativos existem hoje dentro do escopo
 * declarado — o denominador do percentual de ausentes. Recebido por argumento,
 * como todo o resto: a regra não lê o banco.
 *
 * O `requiresConfirmation` daqui é o AVISO que a tela mostra. A fronteira é o
 * commit, que reconta por conta própria: trava que lê um campo gravado pela
 * prévia confia justamente em quem deveria vigiar.
 */
export function resumirImportacao(
  entradas: readonly EntradaDoResumo[],
  ausentes: number,
  noEscopo: number,
  limiarPercentual: number,
): ResumoDaImportacao {
  const conta = (s: ImportRowStatus) => entradas.filter((e) => e.status === s).length;

  const missingPercent = noEscopo === 0 ? 0 : (ausentes * 100) / noEscopo;

  return {
    totalRows: entradas.length,
    createdCount: conta("novo"),
    updatedCount: conta("atualizado"),
    unchangedCount: conta("inalterado"),
    errorCount: conta("erro"),
    conflictCount: conta("conflito"),
    missingCount: ausentes,
    duplicatedCaptureMethods: entradas.filter((e) => e.linha.captureMethodsDuplicados).length,
    addressesWithoutNumber: entradas.filter((e) => e.linha.enderecoSemNumero).length,
    requiresConfirmation: missingPercent > limiarPercentual,
    missingPercent,
  };
}
