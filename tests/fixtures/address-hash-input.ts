/**
 * Entradas para a paridade de `address_hash_input` — a composição dos componentes
 * do endereço na entrada de `normalize_address`.
 *
 * **Sem valores esperados.**
 *
 * Por que esta paridade existe: o hash é chave persistida, e o importador precisa
 * calculá-lo **antes** de gravar para casar a linha pelo fallback do ADR 0001. A
 * composição, portanto, acontece dos dois lados — e componente nulo é o caso em
 * que as duas linguagens divergem por natureza: em SQL, concatenar com nulo dá
 * nulo; em JavaScript, dá a string "null".
 */
export interface EntradaComposicao {
  streetName: string | null;
  streetNumber: string | null;
  district: string | null;
}

export const ENTRADAS_COMPOSICAO: readonly EntradaComposicao[] = [
  { streetName: "Rua Harmonia", streetNumber: "373", district: "Sumarezinho" },
  { streetName: "Avenida Salim Farah Maluf", streetNumber: "0", district: "Parque Sevilha" },
  // Componente ausente: o caso que separa `coalesce` de concatenação direta.
  { streetName: "Rua A", streetNumber: null, district: "Centro" },
  { streetName: "Rua A", streetNumber: "10", district: null },
  { streetName: null, streetNumber: "10", district: "Centro" },
  { streetName: null, streetNumber: null, district: null },
  // Vazio não é nulo, e os dois têm de produzir o mesmo resultado.
  { streetName: "", streetNumber: "", district: "" },
  { streetName: "Rua A", streetNumber: "", district: "Centro" },
  // Espaço em excesso não pode virar diferença de identidade.
  { streetName: "  Rua A  ", streetNumber: " 10 ", district: " Centro " },
  { streetName: "Rua Vinte e Um - de Abril", streetNumber: "55", district: "Centro" },
  { streetName: "Rua B", streetNumber: "7", district: "Jardim São Luís - Zona Sul" },
];
