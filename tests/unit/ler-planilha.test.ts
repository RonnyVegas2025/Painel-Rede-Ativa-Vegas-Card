import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  COLUNAS_ESPERADAS,
  PlanilhaInvalida,
  TAMANHO_MAXIMO_BYTES,
  lerPlanilha,
} from "@/features/importacao/services/ler-planilha";

async function planilha(
  montar: (ws: ExcelJS.Worksheet) => void,
  cabecalho: readonly string[] = COLUNAS_ESPERADAS,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Base");
  ws.addRow([...cabecalho]);
  montar(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Uma linha válida qualquer, na ordem das colunas esperadas. */
const LINHA = [
  "Padaria Um", "01/03/2023", "C-1", "11.222.333/0001-81", "Padaria Um Ltda",
  "Estabelecimento Ativo", "Ativo - CIELO", "Rua Um - N.º: 10 - Centro",
  "01001000", "São Paulo", "SP", "(11) 2967-8777", "CNAE", "Padaria e Confeitaria",
  "Consultor", "Vegas Card", "-", "E-Mail", "CIELO", "18/07/2026",
];

describe("lerPlanilha", () => {
  it("recusa arquivo acima de 20 MB antes de abrir o parser", async () => {
    // O bucket `import-files` já limita na migration 0010, mas um limite que só
    // existe no Storage deixa de existir no dia em que o arquivo chegar por
    // outra porta. E a recusa vem ANTES do parse: passar 20 MB de origem
    // desconhecida por um parser para depois recusar é a ordem errada.
    const grande = Buffer.alloc(TAMANHO_MAXIMO_BYTES + 1);
    await expect(lerPlanilha(grande)).rejects.toBeInstanceOf(PlanilhaInvalida);
    await expect(lerPlanilha(grande)).rejects.toThrow(/excede o limite de 20 MB/);
  });

  it("aceita arquivo dentro do teto", async () => {
    const buf = await planilha((ws) => ws.addRow(LINHA));
    expect(buf.byteLength).toBeLessThan(TAMANHO_MAXIMO_BYTES);
    const { linhas } = await lerPlanilha(buf);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.Contrato).toBe("C-1");
  });

  it("lê o resultado em cache da fórmula, sem avaliá-la", async () => {
    // Fórmula em planilha de origem desconhecida é execução de código de
    // terceiro. O valor em cache é dado; a fórmula é instrução.
    const buf = await planilha((ws) => {
      const linha = ws.addRow(LINHA);
      linha.getCell(3).value = { formula: 'CONCATENATE("C-","9")', result: "C-9" };
    });
    const { linhas } = await lerPlanilha(buf);
    expect(linhas[0]!.Contrato).toBe("C-9");
  });

  it("recusa cabeçalho incompleto, e nomeia o que falta", async () => {
    // O contrato é o CABEÇALHO, não o nome do arquivo: a v1 do CLAUDE.md grafava
    // `Base de Comericos SP.xlsx` com typo, e depender do nome teria quebrado na
    // primeira correção.
    const semCnpj = COLUNAS_ESPERADAS.filter((c) => c !== "CNPJ");
    const buf = await planilha((ws) => ws.addRow(LINHA), semCnpj);
    await expect(lerPlanilha(buf)).rejects.toThrow(/Colunas ausentes.*CNPJ/s);
  });

  it("aceita o cabeçalho fora de ordem: a coluna é lida pelo nome", async () => {
    const invertido = [...COLUNAS_ESPERADAS].reverse();
    const buf = await planilha((ws) => ws.addRow([...LINHA].reverse()), invertido);
    const { linhas } = await lerPlanilha(buf);
    expect(linhas[0]!.Contrato).toBe("C-1");
    expect(linhas[0]!.CEP).toBe("01001000");
  });

  it("ignora linha em branco no fim do arquivo", async () => {
    const buf = await planilha((ws) => {
      ws.addRow(LINHA);
      ws.addRow(COLUNAS_ESPERADAS.map(() => ""));
    });
    const { linhas } = await lerPlanilha(buf);
    expect(linhas).toHaveLength(1);
  });

  it("recusa planilha sem linha de dados", async () => {
    const buf = await planilha(() => {});
    await expect(lerPlanilha(buf)).rejects.toThrow(/nenhuma linha|não tem linhas/);
  });
});
