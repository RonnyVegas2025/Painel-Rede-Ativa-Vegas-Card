export type ImportRowStatus = "novo" | "atualizado" | "inalterado" | "conflito" | "erro" | "ausente";

export interface ImportJob {
  id: string;
  fileName: string;
  storagePath: string;
  uploadedBy: string;
  startedAt: string;
  finishedAt: string | null;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  conflictCount: number;
  /** Presentes na base e ausentes no arquivo. Nunca excluidos: vao para analise. */
  missingCount: number;
}

export interface ImportRow {
  id: string;
  importId: string;
  lineNumber: number;
  status: ImportRowStatus;
  rawData: Record<string, string>;
  establishmentId: string | null;
  errorMessage: string | null;
}
