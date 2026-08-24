/**
 * Decomposição do endereço da planilha.
 *
 * A base traz `Logradouro - N.º: X - Bairro` em 1.804 de 1.804 linhas:
 *
 *     Rua Harmonia - N.º: 373 - Sumarezinho
 *     Avenida Salim Farah Maluf - N.º: 0 - Parque Sevilha
 *
 * O parse existe porque o hash de identidade é sobre os **componentes**, e não
 * sobre a string com o rótulo do formulário de origem. Se `N.º:` mudar de grafia
 * na exportação, os hashes não mudam junto — e hash é chave persistida (ADR 0001).
 *
 * Falha fechada: linha que não casa o padrão devolve `null` em vez de adivinhar.
 * Adivinhar aqui gravaria hash sobre componente errado, e hash errado só se
 * corrige com migração de dados.
 */

export interface EnderecoDecomposto {
  streetName: string;
  /** `0` na origem significa sem número — 61 casos na base. Preservado como veio. */
  streetNumber: string;
  district: string;
}

/**
 * O separador é ` - `, com espaços, e o rótulo do número é tolerante à grafia:
 * `N.º:`, `Nº:`, `N°:`, `No:`, com ou sem espaço antes dos dois pontos.
 *
 * Tolerar variação aqui NÃO contradiz tirar o rótulo do hash: o hash usa os
 * componentes justamente para que a grafia do rótulo deixe de importar. O regex
 * tolerante evita que uma exportação futura com `Nº:` derrube o parse inteiro e
 * mande 1.804 linhas para erro.
 */
const PADRAO = /^(.*?)\s+-\s+N\s*[.°º]*\s*\d*\s*[.°º]*\s*:?\s*(.*?)\s+-\s+(.*)$/i;

/** Forma estrita do rótulo, para não confundir com um hífen qualquer do logradouro. */
const ROTULO = /\s+-\s+N\s*[.]?\s*[°º]?\s*:\s*/i;

export function parseEndereco(bruto: string): EnderecoDecomposto | null {
  if (typeof bruto !== "string") return null;
  const texto = bruto.trim();
  if (texto === "") return null;

  // Corta no rótulo do número, e não no primeiro ` - `: logradouro com hífen
  // ("Rua Vinte e Um - de Abril") quebraria um split ingênuo.
  const marca = ROTULO.exec(texto);
  if (!marca) return null;

  const streetName = texto.slice(0, marca.index).trim();
  const resto = texto.slice(marca.index + marca[0].length);

  // O bairro é o que vem depois do ÚLTIMO ` - `: o número não contém separador,
  // mas o bairro pode ("Jardim São Luís - Zona Sul").
  const corte = resto.indexOf(" - ");
  if (corte < 0) return null;

  const streetNumber = resto.slice(0, corte).trim();
  const district = resto.slice(corte + 3).trim();

  if (streetName === "" || district === "") return null;

  return { streetName, streetNumber, district };
}

/** `N.º: 0` é a forma da origem para "sem número". 61 linhas na base. */
export function semNumero(endereco: EnderecoDecomposto): boolean {
  return endereco.streetNumber === "" || /^0+$/.test(endereco.streetNumber);
}

/**
 * Gêmea de `public.address_hash_input`.
 *
 * Compõe os componentes na entrada de `normalizeAddress`. Existe como função
 * separada, dos dois lados, porque o importador precisa calcular o hash **antes**
 * de gravar — o fallback de identidade do ADR 0001 casa a linha por
 * CNPJ + hash do endereço, e casar exige o hash em mãos antes do insert.
 *
 * `?? ""` e não concatenação direta: componente nulo tornaria a expressão inteira
 * nula em SQL, o hash sumiria em silêncio e o registro deixaria de casar consigo
 * mesmo na importação seguinte — dando duplicata pelo próprio fallback.
 *
 * Comparada com a gêmea SQL pelo arnês do ADR 0010.
 */
export function addressHashInput(
  streetName: string | null,
  streetNumber: string | null,
  district: string | null,
): string {
  return `${streetName ?? ""} ${streetNumber ?? ""} ${district ?? ""}`.trim();
}

export { PADRAO as PADRAO_ENDERECO_LEGADO };
