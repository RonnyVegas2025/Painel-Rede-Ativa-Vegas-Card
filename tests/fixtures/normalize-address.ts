/**
 * Entradas para a paridade de `normalizeAddress` (ADR 0001).
 *
 * **Sem valores esperados.** Quem prova que a normalização está certa é
 * `tests/unit/normalize.test.ts`; quem prova que SQL e TypeScript concordam é o
 * arnês.
 *
 * Esta é a paridade que mais importa do sistema. O hash desta função é **chave
 * persistida**: se as duas implementações divergirem em um hífen ou num `ç`, a
 * importação passa a tratar o mesmo ponto credenciado como dois, e a correção não
 * existe sem migração de dados — os hashes errados já estarão gravados.
 *
 * Por isso as entradas cobrem, deliberadamente, três famílias:
 *
 * 1. **O que deve ser igual apesar de escrito diferente** — abreviação, acento,
 *    pontuação, hífen, espaço repetido, caixa.
 * 2. **O que NÃO pode ser confundido** — palavras que contêm uma abreviação sem
 *    ser uma. `\bal\b` não pode casar dentro de "Alvorada", e `\bav\b` não pode
 *    casar dentro de "Avenida". É onde uma tradução literal de `\b` para `\b` em
 *    POSIX falharia em silêncio, porque lá `\b` é backspace, não fronteira.
 * 3. **O CEP**, que entra no hash só com 8 dígitos.
 */

export interface EntradaEndereco {
  bruto: string;
  cep: string | null;
}

const enderecos: readonly (readonly [string, string | null])[] = [
  // --- abreviações, uma a uma -------------------------------------------------
  ["Av. Paulista, 1578", "01310-200"],
  ["AV PAULISTA 1578", "01310200"],
  ["Avenida Paulista 1578", "01310200"],
  ["R. Augusta, 900", "01304-001"],
  ["Rua Augusta 900", null],
  ["Pc. da Se, 100", null],
  ["Pca. da Se 100", null],
  ["Praca da Se 100", null],
  ["Rod. Anhanguera, km 23", null],
  ["Estr. do Campo Limpo, 45", null],
  ["Trav. Bento Freitas, 5", null],
  ["Tv. Bento Freitas 5", null],
  ["Al. Santos, 700", null],
  ["Jd. America", null],
  ["Vl. Mariana", null],
  ["Pq. Ibirapuera", null],

  // --- acentuação: o caso que unaccent resolveria e translate precisa cobrir ---
  ["Avenida São João, 300", "01035-000"],
  ["AVENIDA SÃO JOÃO 300", "01035000"],
  ["Rua José Bonifácio, 12", null],
  ["Rua Conceição, 88", null],
  ["Praça Ramos de Azevedo", null],
  ["Rua Ipê Amarelo, 7", null],
  ["Avenida Ângelo Muzzi", null],
  ["Rua Antônio Cândido", null],
  ["Rua Úrsula Paulino", null],
  ["Avenida Güell", null],
  ["Rua Niños Héroes", null],
  ["Rua Açaí do Pará, 1", null],
  ["RUA AÇAÍ DO PARÁ 1", null],

  // --- pontuação, hífen, barra, espaço ---------------------------------------
  ["Rua A, 10 - Centro", null],
  ["Rua A 10 Centro", null],
  ["Rua  A   10    Centro", null],
  ["Rua A; 10: Centro", null],
  ["  Rua A, 10 - Centro  ", null],
  ["Rua A, 10 / Centro", null],

  // --- sem número -------------------------------------------------------------
  ["Rua das Flores, s/n", null],
  ["Rua das Flores sn", null],
  ["Rua das Flores, S/N", null],

  // --- complemento ------------------------------------------------------------
  ["Rua C, 10, apto 21", null],
  ["Rua C 10 ap 21", null],
  ["Rua C, 10, apartamento 21", null],

  // --- negativos: contêm uma abreviação sem ser uma ---------------------------
  ["Rua Alvorada, 30", null],
  ["Avenida Alvorada 30", null],
  ["Rua Avenida Brasil", null],
  ["Rua Ravena, 4", null],
  ["Rua Pcaro", null],
  ["Rua Snow", null],
  ["Rua Aptidao 5", null],
  ["Rua Jardim Botanico", null],
  ["Rua Parque das Nacoes", null],
  ["Rua Vila Nova", null],
  ["Rua Estrada Velha", null],
  ["Rua Travessia do Sol", null],

  // --- CEP: entra no hash só com 8 dígitos ------------------------------------
  ["Rua X, 1", "01310-200"],
  ["Rua X, 1", "01310200"],
  ["Rua X, 1", "1310200"],
  ["Rua X, 1", "013102000"],
  ["Rua X, 1", ""],
  ["Rua X, 1", null],
  ["Rua X, 1", "abc"],
  ["Rua X, 1", "01310-abc"],

  // --- degenerados ------------------------------------------------------------
  ["", null],
  ["   ", null],
  [",,,", null],
  ["---", null],
  ["123", null],
  ["Rua", null],
  ["av", null],
  ["AV", null],
  ["s/n", null],
];

export const ENTRADAS_ENDERECO: readonly EntradaEndereco[] = enderecos.map(
  ([bruto, cep]) => ({ bruto, cep }),
);
