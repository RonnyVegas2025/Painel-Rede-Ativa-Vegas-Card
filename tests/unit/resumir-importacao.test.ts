import { describe, expect, it } from "vitest";
import { normalizeLinhaImportacao, type LinhaCrua } from "@/lib/business-rules/normalize-linha-importacao";
import { resumirImportacao } from "@/lib/business-rules/resumir-importacao";

const BASE: LinhaCrua = {
  Empresa: "Padaria Um", "Data de Cadastro": "01/03/2023", Contrato: "C-1",
  CNPJ: "11.222.333/0001-81", "Razão Social": "Padaria Um Ltda",
  Status: "Estabelecimento Ativo", Descrição: "Ativo",
  Endereço: "Rua Um - N.º: 10 - Centro", CEP: "01001000", Cidade: "São Paulo",
  UF: "SP", Telefone: "(11) 2967-8777", CNAE: "CNAE", Subgrupo: "Padaria",
  Consultores: "Consultor", Origem: "Vegas Card", "E-mail": "-",
  Captação: "E-Mail", Terminal: "CIELO", "Última Transação": "18/07/2026",
};
const com = (p: Partial<LinhaCrua>) => normalizeLinhaImportacao({ ...BASE, ...p });

describe("meio de captura repetido na origem", () => {
  it("deduplica e MARCA — `CIELO / CIELO` vira um vínculo, e fica registrado", () => {
    // A identidade de um ponto é (estabelecimento, meio): inserir os dois
    // violaria o índice único e a importação inteira quebraria. Deduplicar é
    // obrigatório; deduplicar em silêncio faria o dado errado voltar em toda
    // importação sem ninguém notar.
    const l = com({ Terminal: "CIELO / CIELO" });
    expect(l.captureMethodSourceNames).toEqual(["CIELO"]);
    expect(l.captureMethodsDuplicados).toBe(true);
  });

  it("não marca quando os meios são distintos", () => {
    const l = com({ Terminal: "Software Express Sitef / CIELO / Rede" });
    expect(l.captureMethodSourceNames).toHaveLength(3);
    expect(l.captureMethodsDuplicados).toBe(false);
  });
});

describe("resumirImportacao", () => {
  it("conta os defeitos da origem, não só os status", () => {
    const entradas = [
      { linha: com({ Terminal: "CIELO / CIELO" }), status: "novo" as const },
      { linha: com({ Endereço: "Rua Dois - N.º: 0 - Centro", Contrato: "" }), status: "conflito" as const },
      { linha: com({}), status: "inalterado" as const },
    ];
    const r = resumirImportacao(entradas, 0, 10, 20);
    expect(r.duplicatedCaptureMethods).toBe(1);
    expect(r.addressesWithoutNumber).toBe(1);
    expect(r.conflictCount).toBe(1);
    expect(r.createdCount).toBe(1);
    expect(r.unchangedCount).toBe(1);
  });

  it("avisa acima do limiar, e não avisa em cima dele", () => {
    // Estritamente maior: 20 de 100 com limiar de 20 passa. A fronteira real é
    // do commit, que reconta — este é o aviso que a tela mostra antes do clique.
    const e = [{ linha: com({}), status: "inalterado" as const }];
    expect(resumirImportacao(e, 20, 100, 20).requiresConfirmation).toBe(false);
    expect(resumirImportacao(e, 21, 100, 20).requiresConfirmation).toBe(true);
  });

  it("base vazia não dispara o aviso: não há ausente possível", () => {
    const e = [{ linha: com({}), status: "novo" as const }];
    const r = resumirImportacao(e, 0, 0, 20);
    expect(r.missingPercent).toBe(0);
    expect(r.requiresConfirmation).toBe(false);
  });
});
