/**
 * Paridade da composição do endereço (migration 0032).
 *
 * Fecha a última porta de divergência do hash de identidade: `normalize_address`
 * já estava no arnês, mas a composição dos componentes acontecia embutida na
 * coluna gerada de um lado e escrita de memória do outro.
 */
import { addressHashInput } from "@/lib/business-rules/parse-endereco";
import {
  ENTRADAS_COMPOSICAO,
  type EntradaComposicao,
} from "../fixtures/address-hash-input";
import { verificarParidade } from "./harness";

verificarParidade<EntradaComposicao>(
  {
    nome: "address_hash_input",
    funcaoSql: "address_hash_input",
    argumentosSql: (e) => [e.streetName, e.streetNumber, e.district],
    funcaoTs: (e) => addressHashInput(e.streetName, e.streetNumber, e.district),
    rotulo: (e) =>
      `${JSON.stringify(e.streetName)} / ${JSON.stringify(e.streetNumber)} / ${JSON.stringify(e.district)}`,
  },
  ENTRADAS_COMPOSICAO,
);
