/**
 * Paridade da elegibilidade de segmento (ADR 0003).
 *
 * A falha fechada decide o critério de aceite número um: em modo `allowlist`,
 * segmento sem regra é inelegível, e é isso que impede Farmácia de exibir posto
 * de combustível enquanto o mapeamento de Subgrupo estiver incompleto.
 *
 * A regra existe em SQL — usada por `eligible_segments`, que alimenta o filtro do
 * mapa e a listagem — e em TypeScript, usada pela interface de administração e
 * pelo importador para avisar antes de o INSERT falhar. Divergir significa a tela
 * oferecer um segmento que o banco não vai aceitar, ou esconder um que aceitaria.
 */
import { isSegmentEligible } from "@/lib/business-rules/check-product-eligibility";
import {
  ENTRADAS_ELEGIBILIDADE,
  type EntradaElegibilidade,
} from "../fixtures/segment-eligibility";
import { verificarParidade } from "./harness";

verificarParidade<EntradaElegibilidade>(
  {
    nome: "is_segment_eligible",
    funcaoSql: "is_segment_eligible",
    argumentosSql: (entrada) => [entrada.modo, entrada.regra],
    funcaoTs: (entrada) => isSegmentEligible(entrada.modo, entrada.regra),
    rotulo: (e) => `modo ${e.modo} com regra ${e.regra ?? "ausente"}`,
  },
  ENTRADAS_ELEGIBILIDADE,
);
