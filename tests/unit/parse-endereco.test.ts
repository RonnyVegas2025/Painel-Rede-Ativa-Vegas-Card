import { describe, expect, it } from "vitest";
import { parseEndereco, semNumero } from "@/lib/business-rules/parse-endereco";

/**
 * Validado contra as 1.804 linhas reais de `Base de Comercios SP.xlsx` antes de
 * estes casos serem escritos: **zero falhas de parse**, 61 sem número — batendo a
 * medição independente da planilha. Os casos abaixo destilam o que o arquivo tem,
 * mais os que ele ainda não tem e que quebrariam um parser ingênuo.
 */
describe("parseEndereco", () => {
  it("decompõe a forma da planilha", () => {
    expect(parseEndereco("Rua Harmonia - N.º: 373 - Sumarezinho")).toEqual({
      streetName: "Rua Harmonia",
      streetNumber: "373",
      district: "Sumarezinho",
    });
  });

  it("preserva o número 0, que na origem significa sem número", () => {
    const r = parseEndereco("Avenida Salim Farah Maluf - N.º: 0 - Parque Sevilha");
    expect(r).toEqual({
      streetName: "Avenida Salim Farah Maluf",
      streetNumber: "0",
      district: "Parque Sevilha",
    });
    expect(semNumero(r!)).toBe(true);
  });

  it.each([
    ["N.º:", "Rua A - N.º: 10 - Centro"],
    ["Nº:", "Rua A - Nº: 10 - Centro"],
    ["N°:", "Rua A - N°: 10 - Centro"],
    ["N.:", "Rua A - N.: 10 - Centro"],
    ["espaço antes dos dois pontos", "Rua A - N.º : 10 - Centro"],
  ])("tolera a grafia %s do rótulo", (_nome, entrada) => {
    // Tolerar variação aqui NÃO contradiz tirar o rótulo do hash: o hash usa os
    // componentes justamente para que a grafia deixe de importar. O regex
    // tolerante evita que uma exportação futura com `Nº:` derrube 1.804 linhas
    // para erro de uma vez.
    expect(parseEndereco(entrada)).toEqual({
      streetName: "Rua A",
      streetNumber: "10",
      district: "Centro",
    });
  });

  // --- o que quebraria um split ingênuo ---------------------------------------

  it("logradouro com hífen não confunde o corte", () => {
    // Não aparece na base atual, e apareceria no dia em que a exportação incluir
    // um logradouro assim. Cortar no primeiro ` - ` daria "Rua Vinte e Um".
    expect(parseEndereco("Rua Vinte e Um - de Abril - N.º: 55 - Centro")).toEqual({
      streetName: "Rua Vinte e Um - de Abril",
      streetNumber: "55",
      district: "Centro",
    });
  });

  it("bairro com hífen é preservado inteiro", () => {
    expect(parseEndereco("Rua B - N.º: 7 - Jardim São Luís - Zona Sul")).toEqual({
      streetName: "Rua B",
      streetNumber: "7",
      district: "Jardim São Luís - Zona Sul",
    });
  });

  // --- falha fechada ----------------------------------------------------------

  it.each([
    ["vazio", ""],
    ["só espaços", "   "],
    ["sem o rótulo do número", "Rua A, 10, Centro"],
    ["sem bairro", "Rua A - N.º: 10"],
    ["sem logradouro", " - N.º: 10 - Centro"],
    ["só o rótulo", "N.º: 10"],
  ])("devolve null para %s em vez de adivinhar", (_nome, entrada) => {
    // Adivinhar gravaria hash sobre componente errado, e hash errado só se
    // corrige com migração de dados (ADR 0001). A linha vai para erro na
    // importação, que é onde alguém consegue olhar.
    expect(parseEndereco(entrada)).toBeNull();
  });

  it("aparas de espaço não viram diferença de identidade", () => {
    expect(parseEndereco("  Rua A  -  N.º:  10  -  Centro  ")).toEqual({
      streetName: "Rua A",
      streetNumber: "10",
      district: "Centro",
    });
  });
});

describe("semNumero", () => {
  it.each([
    ["0", true],
    ["00", true],
    ["", true],
    ["10", false],
    ["S/N", false],
  ])("número %s → sem número: %s", (numero, esperado) => {
    expect(
      semNumero({ streetName: "Rua A", streetNumber: numero, district: "Centro" }),
    ).toBe(esperado);
  });
});
