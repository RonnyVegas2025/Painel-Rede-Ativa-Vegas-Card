import "server-only";

import ExcelJS from "exceljs";
import type { LinhaCrua } from "@/lib/business-rules/normalize-linha-importacao";

/**
 * Adaptador do `.xlsx`. **É o único lugar do sistema que conhece a biblioteca.**
 *
 * A regra de negócio recebe `LinhaCrua` e não sabe de onde veio: é o que a torna
 * testável sem a biblioteca, e o que torna a escolha reversível.
 *
 * ## Por que `exceljs`, e não `xlsx`
 *
 * Consistência de plataforma — já é o padrão do CRM Credenciamento. E porque o
 * pacote `xlsx` do npm é software abandonado: o SheetJS deixou de publicar no
 * registro público e passou a distribuir pelo próprio CDN, então o que está no
 * npm é versão antiga com vulnerabilidade de prototype pollution conhecida e sem
 * correção naquele canal. `npm install xlsx` instala isso.
 *
 * Versão **fixada**, sem `^`: parser de arquivo externo é superfície de ataque, e
 * atualização de parser entra por decisão, não por resolução de intervalo.
 */

/** Colunas esperadas, na ordem e na grafia da origem. */
export const COLUNAS_ESPERADAS = [
  "Empresa", "Data de Cadastro", "Contrato", "CNPJ", "Razão Social", "Status",
  "Descrição", "Endereço", "CEP", "Cidade", "UF", "Telefone", "CNAE", "Subgrupo",
  "Consultores", "Origem", "E-mail", "Captação", "Terminal", "Última Transação",
] as const;

/**
 * Teto de tamanho, repetido aqui de propósito.
 *
 * O bucket `import-files` já limita a 20 MiB na migration 0010, mas o caminho de
 * upload pode mudar — e um limite que só existe no Storage deixa de existir no
 * dia em que o arquivo chegar por outra porta.
 */
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;

export class PlanilhaInvalida extends Error {}

function textoDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) {
    // A planilha traz datas como texto DD/MM/AAAA; se o Excel converter alguma
    // para data real, devolvemos na mesma convenção em vez de ISO, para a regra
    // de negócio ver sempre o mesmo formato.
    const dd = String(valor.getUTCDate()).padStart(2, "0");
    const mm = String(valor.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${valor.getUTCFullYear()}`;
  }
  if (typeof valor === "object") {
    // Célula com fórmula. **O resultado em cache é lido; a fórmula NUNCA é
    // avaliada.** Fórmula em planilha de origem desconhecida é execução de código
    // de terceiro, e o importador não é lugar para isso.
    if ("result" in valor && valor.result !== undefined && valor.result !== null) {
      return textoDaCelula(valor.result as ExcelJS.CellValue);
    }
    if ("richText" in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((p) => p.text).join("").trim();
    }
    if ("text" in valor && typeof valor.text === "string") return valor.text.trim();
    return "";
  }
  return String(valor).trim();
}

export interface PlanilhaLida {
  linhas: LinhaCrua[];
  /** Nome da aba lida, para o relatório dizer de onde os dados vieram. */
  aba: string;
}

/**
 * Lê a planilha e devolve as linhas cruas.
 *
 * Não valida regra de negócio — isso é do normalizador. Valida apenas o que
 * impede continuar: tamanho, cabeçalho e ausência de linhas.
 */
export async function lerPlanilha(conteudo: Buffer): Promise<PlanilhaLida> {
  if (conteudo.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new PlanilhaInvalida(
      `Arquivo com ${(conteudo.byteLength / 1024 / 1024).toFixed(1)} MB excede o limite de 20 MB.`,
    );
  }

  const wb = new ExcelJS.Workbook();
  // O `exceljs` declara seu próprio `Buffer`, incompatível com o do @types/node
  // 22 em nível de tipo — os dois são o mesmo objeto em execução. A ponte fica
  // aqui, no adaptador, que é onde a biblioteca já é conhecida; `any` não entra
  // (CLAUDE.md §16), então o alvo é derivado da própria assinatura.
  await wb.xlsx.load(conteudo as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws = wb.worksheets[0];
  if (!ws) throw new PlanilhaInvalida("A planilha não tem nenhuma aba.");

  const cabecalho = (ws.getRow(1).values as ExcelJS.CellValue[])
    .slice(1)
    .map((c) => textoDaCelula(c));

  const faltando = COLUNAS_ESPERADAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length > 0) {
    // O cabeçalho é o contrato, não o nome do arquivo: a versão 1 do CLAUDE.md
    // grafava `Base de Comericos SP.xlsx` com typo, e depender do nome teria
    // quebrado na primeira correção.
    throw new PlanilhaInvalida(
      `Colunas ausentes no cabeçalho: ${faltando.join(", ")}. Encontradas: ${cabecalho.filter(Boolean).join(", ")}.`,
    );
  }

  const indice = new Map(cabecalho.map((nome, i) => [nome, i + 1]));
  const linhas: LinhaCrua[] = [];

  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;
    const celula = (nome: string) => textoDaCelula(row.getCell(indice.get(nome)!).value);
    // Linha em branco no fim do arquivo é comum em exportação e não é erro.
    if (COLUNAS_ESPERADAS.every((c) => celula(c) === "")) return;

    linhas.push(
      Object.fromEntries(COLUNAS_ESPERADAS.map((c) => [c, celula(c)])) as unknown as LinhaCrua,
    );
  });

  if (linhas.length === 0) throw new PlanilhaInvalida("A planilha não tem linhas de dados.");

  return { linhas, aba: ws.name };
}
