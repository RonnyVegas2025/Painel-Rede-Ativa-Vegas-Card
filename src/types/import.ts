/**
 * Importacao como sincronizacao, nao cadastro.
 *
 * Conferido campo a campo contra o schema real da migration 0018. A versao
 * anterior foi escrita na Sprint 0, antes de a tabela existir, e faltavam o
 * escopo, a trava de confirmacao e `unchangedCount`.
 */

/**
 * Espelha o enum `public.import_row_status`, valor a valor. Divergir faria o tipo
 * mentir sobre o que o banco aceita.
 */
export type ImportRowStatus =
  | "novo"
  | "atualizado"
  | "inalterado"
  | "conflito"
  | "erro"
  /** Presente na base, ausente do arquivo. **Nunca excluido**: vai para analise. */
  | "ausente";

export interface ImportJob {
  id: string;
  fileName: string;
  storagePath: string;
  uploadedBy: string | null;

  /**
   * Escopo declarado (ADR 0011). Nulo significa "toda a base". O estado `ausente`
   * so e calculado DENTRO do escopo: sem isso, importar o recorte de uma cidade
   * faria o resto da base inteira aparecer como sumido.
   */
  scopeCity: string | null;
  scopeCardProductId: string | null;

  startedAt: string;
  finishedAt: string | null;

  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  conflictCount: number;
  /** Presentes na base e ausentes no arquivo. Nunca excluidos. */
  missingCount: number;

  /**
   * Trava do limiar de ausentes (ADR 0011). O desastre classico e exportar a
   * planilha com um filtro aplicado e a base inteira aparecer como sumida. Nada
   * seria excluido, mas uma fila administrativa com 1.400 itens e indistinguivel
   * de ruido, e o efeito pratico e o mesmo.
   *
   * O limiar vive em `system_settings`, nunca em componente.
   */
  requiresConfirmation: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ImportRow {
  id: string;
  importId: string;
  lineNumber: number;
  status: ImportRowStatus;
  /**
   * Linha crua da planilha. Dado de terceiro — telefone, e-mail, razao social —,
   * por isso a leitura e restrita a quem executa importacao, e nao ha policy de
   * escrita: a linha e evidencia do que o arquivo trazia, nao dado editavel.
   */
  rawData: Record<string, string>;
  /** Nulo quando a linha nao casou com nenhum estabelecimento. */
  establishmentId: string | null;
  errorMessage: string | null;
  createdAt: string;
}
