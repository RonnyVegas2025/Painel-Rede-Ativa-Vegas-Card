import { describe, expect, it } from "vitest";
import {
  normalizeLinhaImportacao,
  separarMeiosDeCaptura,
  temConflito,
  temErro,
  type LinhaCrua,
} from "@/lib/business-rules/normalize-linha-importacao";

/**
 * Validado contra as 1.804 linhas reais antes destes casos serem escritos.
 * Resultado medido, e que as fixtures abaixo destilam:
 *
 *   13 meios · 3.577 vínculos · 15 segmentos · 1.255 e-mails nulos
 *   61 sem número · 319 nunca transacionaram · 0 erros · 1 conflito
 *
 * A distribuição transacional saiu exata contra a medição independente. Mas ela
 * TEM PRAZO: quatro das cinco faixas são função da data em que se mede — em
 * 24/08/2026 eram 293 · 285 · 132 · 775 · 319, e dois dias depois já eram
 * 232 · 340 · 134 · 779 · 319, com 61 estabelecimentos saindo de `recente`.
 *
 * Nada disso é defeito: é o comportamento correto de uma classificação por
 * recência. Mas nenhum teste pode afirmar aqueles quatro números contra `now()` —
 * ficaria verde hoje e vermelho em duas semanas, por motivo nenhum, que é como
 * teste aprende a ser ignorado (PLATFORM-STANDARDS §8).
 *
 * O que é ATEMPORAL, e por isso é o que se verifica:
 *
 *   - a soma das cinco faixas é 1.804, sempre;
 *   - `nunca_transacionou` é 319 — não depende da data, e sim da coluna;
 *   - as faixas não se sobrepõem nem deixam buraco.
 *
 * A terceira é provada por igualdade de conjuntos em
 * `tests/parity-db/intervalo-de-recencia.parity.test.ts`, em qualquer data.
 */
const base: LinhaCrua = {
  Empresa: "Atacadao 0340 AS",
  "Data de Cadastro": "15/03/2019",
  Contrato: "61166914",
  CNPJ: "11.222.333/0001-81",
  "Razão Social": "Atacadão S.A.",
  Status: "Estabelecimento Ativo",
  Descrição: "Ativo - CIELO/REDE/TEF 27 Mar 2023 13:42:45:177",
  Endereço: "Rua Harmonia - N.º: 373 - Sumarezinho",
  CEP: "01310-200",
  Cidade: "São Paulo",
  UF: "SP",
  Telefone: "(11) 3000-0000",
  CNAE: "4711-3/02",
  Subgrupo: "Comércio Verejista - Supermercados",
  Consultores: "Vegas Card do Brasil",
  Origem: "Prospecção",
  "E-mail": "-",
  Captação: "Pessoalmente",
  Terminal: "Software Express Sitef / CIELO / Rede",
  "Última Transação": "01/08/2026",
};

const com = (p: Partial<LinhaCrua>): LinhaCrua => ({ ...base, ...p });

describe("separarMeiosDeCaptura", () => {
  it("separa por barra e apara espaço", () => {
    expect(separarMeiosDeCaptura("Software Express Sitef / CIELO / Rede")).toEqual([
      "Software Express Sitef", "CIELO", "Rede",
    ]);
  });

  it("deduplica o mesmo meio repetido na linha", () => {
    // 9 das 1.804 linhas fazem isso: `CIELO / CIELO`. Como a identidade de um
    // ponto é (establishment_id, capture_method_id), inserir os dois violaria o
    // índice único e a primeira importação quebraria.
    expect(separarMeiosDeCaptura("CIELO / CIELO")).toEqual(["CIELO"]);
    expect(separarMeiosDeCaptura("Software Express Sitef / CIELO / Rede / Rede")).toEqual([
      "Software Express Sitef", "CIELO", "Rede",
    ]);
  });

  it("vazio não vira meio", () => {
    expect(separarMeiosDeCaptura("")).toEqual([]);
    expect(separarMeiosDeCaptura(" / / ")).toEqual([]);
  });
});

describe("normalizeLinhaImportacao", () => {
  it("normaliza a linha típica sem problema", () => {
    const n = normalizeLinhaImportacao(base);
    expect(temErro(n)).toBe(false);
    expect(temConflito(n)).toBe(false);
    expect(n.cnpj).toBe("11222333000181");
    expect(n.cep).toBe("01310200");
    expect(n.phone).toBe("1130000000");
    expect(n.endereco).toEqual({
      streetName: "Rua Harmonia", streetNumber: "373", district: "Sumarezinho",
    });
    expect(n.captureMethodSourceNames).toHaveLength(3);
    expect(n.enderecoHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("`-` em e-mail vira nulo, não um traço", () => {
    // 1.255 das 1.804 linhas. Sem isto, 70% da base ficaria com e-mail "-" e
    // qualquer tela de contato mostraria um traço como endereço válido.
    expect(normalizeLinhaImportacao(base).email).toBeNull();
    expect(normalizeLinhaImportacao(com({ "E-mail": "loja@x.com.br" })).email).toBe("loja@x.com.br");
  });

  it("`Nunca Transacionou` separa ausência de dado de ausência de transação", () => {
    const n = normalizeLinhaImportacao(com({ "Última Transação": "Nunca Transacionou" }));
    expect(n.neverTransacted).toBe(true);
    expect(n.lastTransactionAt).toBeNull();
    expect(temErro(n)).toBe(false);
  });

  it("guarda Subgrupo e Consultores crus, com os erros da origem", () => {
    const n = normalizeLinhaImportacao(base);
    // O typo "Verejista" é preservado: é a chave de reconciliação.
    expect(n.segmentSourceName).toBe("Comércio Verejista - Supermercados");
    // A empresa, não uma pessoa. Nunca casado com profiles automaticamente.
    expect(n.assignedConsultantsRaw).toBe("Vegas Card do Brasil");
  });

  it("Descrição fica crua, sem parse", () => {
    // Ela traz `TEF`, que não existe em `Terminal` — duas fontes para o mesmo
    // fato é o problema já evitado três vezes neste projeto.
    expect(normalizeLinhaImportacao(base).descriptionRaw).toContain("TEF");
  });

  it("CPF é CONFLITO, nunca erro: rejeitar perderia dado real", () => {
    const n = normalizeLinhaImportacao(com({ CNPJ: "30771081863" }));
    expect(temErro(n)).toBe(false);
    expect(temConflito(n)).toBe(true);
    expect(n.problemas[0]?.mensagem).toMatch(/11 dígitos/);
  });

  it("endereço fora do padrão é erro, e não adivinhação", () => {
    const n = normalizeLinhaImportacao(com({ Endereço: "Rua A, 10, Centro" }));
    expect(temErro(n)).toBe(true);
    expect(n.enderecoHash).toBeNull();
  });

  it("sem número é sinalizado, não rejeitado", () => {
    const n = normalizeLinhaImportacao(com({ Endereço: "Avenida X - N.º: 0 - Bairro" }));
    expect(n.enderecoSemNumero).toBe(true);
    expect(temErro(n)).toBe(false);
  });

  it("sem contrato E sem número: o fallback fica fraco e vira conflito", () => {
    const n = normalizeLinhaImportacao(
      com({ Contrato: "", Endereço: "Avenida X - N.º: 0 - Bairro" }),
    );
    expect(temConflito(n)).toBe(true);
  });

  it("data fora de DD/MM/AAAA é erro", () => {
    expect(temErro(normalizeLinhaImportacao(com({ "Última Transação": "2026-08-01" })))).toBe(true);
    expect(temErro(normalizeLinhaImportacao(com({ "Data de Cadastro": "31/02/2020" })))).toBe(true);
  });
});
