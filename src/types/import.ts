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

export type ImportJobStatus =
  | "processando"
  | "previa"
  | "aplicando"
  | "concluida"
  | "cancelada"
  | "falhou";

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

  /**
   * Ciclo de vida. O commit exige `previa` e muda para `aplicando` na mesma
   * transacao: e o que impede que confirmar duas vezes importe duas vezes.
   *
   * `processando` e o job em montagem — a previa esta gravando as linhas. Nao e
   * aplicavel, e existe para que um lote interrompido na linha 900 nao pareca
   * completo.
   */
  status: ImportJobStatus;

  /**
   * Linhas cujo campo `Terminal` repetia o mesmo meio — `CIELO / CIELO`.
   * Deduplicado na aplicacao, porque a identidade de um ponto e
   * `(estabelecimento, meio)`. Contado aqui porque e defeito da ORIGEM, e
   * silenciar faria o dado errado voltar em toda importacao.
   */
  duplicatedCaptureMethods: number;
  /** Enderecos com `N.o: 0`: o fallback de identidade fica fraco neles. */
  addressesWithoutNumber: number;
  /** Motivo do descarte, ou a duracao do commit. */
  errorMessage: string | null;

  /**
   * A importacao descartada que originou esta, quando o operador redeclarou o
   * escopo. Torna a historia legivel: "esta foi redeclarada apos erro de escopo".
   */
  derivadoDeId: string | null;

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
