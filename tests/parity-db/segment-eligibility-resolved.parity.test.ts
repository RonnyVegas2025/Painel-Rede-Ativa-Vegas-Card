/**
 * Paridade de `eligible_segment_ids` — elegibilidade resolvida pelo canônico.
 *
 * Primeira paridade que protege uma **mudança de regra**, e não uma tradução
 * entre linguagens. O alias não existia; as duas implementações mudaram juntas, e
 * o que garante que mudaram do mesmo jeito é isto.
 *
 * Divergir significa a tela oferecer um segmento que o mapa filtra fora, ou
 * esconder um que o banco considera elegível — sem erro em lugar nenhum.
 */
import {
  eligibleSegmentIds,
  type SegmentForEligibility,
  type SegmentRule,
} from "@/lib/business-rules/check-product-eligibility";
import {
  ENTRADAS_ELEGIBILIDADE_RESOLVIDA,
  type EntradaElegibilidadeResolvida,
} from "../fixtures/segment-eligibility-resolved";
import { verificarParidade } from "./harness";

/**
 * O lado SQL devolve `uuid[]`, que o arnês lê como texto no formato do Postgres:
 * `{a,b}`. O lado TypeScript devolve `string[]`.
 *
 * Formatar aqui é adaptação de **representação**, não de regra: as duas listas já
 * saem ordenadas das próprias funções, e os ids das fixtures são UUIDs, sem
 * vírgula, chave ou aspa — então a forma textual é inequívoca e nada pode se
 * esconder na conversão.
 */
function comoArrayDoPostgres(ids: readonly string[]): string {
  return `{${ids.join(",")}}`;
}

verificarParidade<EntradaElegibilidadeResolvida>(
  {
    nome: "eligible_segment_ids",
    funcaoSql: "eligible_segment_ids",
    argumentosSql: (e) => [
      e.modo,
      JSON.stringify(e.segmentos),
      JSON.stringify(e.regras),
    ],
    funcaoTs: (e) => {
      const segmentos: SegmentForEligibility[] = e.segmentos.map((s) => ({
        id: s.id,
        isActive: s.is_active,
        canonicalSegmentId: s.canonical_segment_id,
      }));
      const regras: SegmentRule[] = e.regras.map((r) => ({
        segmentId: r.segment_id,
        ruleType: r.rule_type,
      }));
      return comoArrayDoPostgres(eligibleSegmentIds(e.modo, segmentos, regras));
    },
    rotulo: (e) => e.nome,
  },
  ENTRADAS_ELEGIBILIDADE_RESOLVIDA,
);
