/**
 * Entradas para a paridade de `eligible_segment_ids` — a elegibilidade resolvida
 * pelo segmento canônico (migrations 0023 e 0024).
 *
 * **Sem valores esperados.** Quem prova que a regra está certa é
 * `tests/unit/product-eligibility.test.ts`; quem prova que SQL e TypeScript
 * concordam é o arnês.
 *
 * ## Por que esta paridade é diferente das outras
 *
 * As três anteriores comparam **traduções**: a mesma regra escrita duas vezes,
 * uma por linguagem. Esta compara uma **mudança de regra** — o alias não existia,
 * e as duas implementações mudaram juntas.
 *
 * É o caso em que a paridade vale mais. Numa tradução, a divergência costuma ser
 * de sintaxe e aparece em qualquer entrada. Numa mudança de regra, a divergência
 * é de entendimento e só aparece nos casos que ninguém pensou — alias cujo
 * canônico foi desativado, regra pendurada no alias em vez do canônico, dois
 * aliases para o mesmo canônico.
 *
 * Se as duas divergirem, a tela mostra uma elegibilidade e o mapa filtra outra.
 */

export type ModoElegibilidade = "all" | "allowlist" | "denylist";
export type TipoRegra = "allow" | "deny";

export interface SegmentoEntrada {
  id: string;
  is_active: boolean;
  canonical_segment_id: string | null;
}

export interface RegraEntrada {
  segment_id: string;
  rule_type: TipoRegra;
}

export interface EntradaElegibilidadeResolvida {
  nome: string;
  modo: ModoElegibilidade;
  segmentos: readonly SegmentoEntrada[];
  regras: readonly RegraEntrada[];
}

// UUIDs fixos e legíveis. Sem vírgula, chave ou aspa, para a representação de
// array do Postgres — `{a,b}` — não precisar de escape e ser comparável direto.
const PADARIA = "00000000-0000-4000-8000-000000000001";
const CONFEITARIA = "00000000-0000-4000-8000-000000000002";
const PANIFICADORA = "00000000-0000-4000-8000-000000000003";
const POSTO = "00000000-0000-4000-8000-000000000004";
const POSTO_COMBUSTIVEL = "00000000-0000-4000-8000-000000000005";
const FARMACIA = "00000000-0000-4000-8000-000000000006";
const DROGARIA = "00000000-0000-4000-8000-000000000007";
const NOVO = "00000000-0000-4000-8000-000000000008";

const canonico = (id: string, is_active = true): SegmentoEntrada => ({
  id,
  is_active,
  canonical_segment_id: null,
});
const alias = (
  id: string,
  canonical_segment_id: string,
  is_active = true,
): SegmentoEntrada => ({ id, is_active, canonical_segment_id });

const permite = (segment_id: string): RegraEntrada => ({ segment_id, rule_type: "allow" });
const nega = (segment_id: string): RegraEntrada => ({ segment_id, rule_type: "deny" });

export const ENTRADAS_ELEGIBILIDADE_RESOLVIDA: readonly EntradaElegibilidadeResolvida[] = [
  {
    nome: "allowlist sem alias — criterio de aceite 1",
    modo: "allowlist",
    segmentos: [canonico(FARMACIA), canonico(DROGARIA), canonico(POSTO)],
    regras: [permite(FARMACIA), permite(DROGARIA)],
  },
  {
    nome: "alias herda a elegibilidade do canonico",
    modo: "allowlist",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA)],
    regras: [permite(PADARIA)],
  },
  {
    nome: "dois aliases para o mesmo canonico",
    modo: "allowlist",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA), alias(PANIFICADORA, PADARIA)],
    regras: [permite(PADARIA)],
  },
  {
    nome: "regra pendurada no alias nao governa",
    modo: "allowlist",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA)],
    regras: [permite(CONFEITARIA)],
  },
  {
    nome: "regra no alias E no canonico — so a do canonico conta",
    modo: "allowlist",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA)],
    regras: [permite(PADARIA), nega(CONFEITARIA)],
  },
  {
    nome: "canonico inativo derruba o alias junto",
    modo: "allowlist",
    segmentos: [canonico(PADARIA, false), alias(CONFEITARIA, PADARIA)],
    regras: [permite(PADARIA)],
  },
  {
    nome: "alias inativo sai, canonico fica",
    modo: "allowlist",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA, false)],
    regras: [permite(PADARIA)],
  },
  {
    nome: "alias apontando para canonico ausente da lista",
    modo: "allowlist",
    segmentos: [alias(CONFEITARIA, PADARIA)],
    regras: [permite(PADARIA)],
  },
  {
    nome: "denylist: negar o canonico remove os aliases",
    modo: "denylist",
    segmentos: [canonico(POSTO), alias(POSTO_COMBUSTIVEL, POSTO), canonico(PADARIA)],
    regras: [nega(POSTO)],
  },
  {
    nome: "denylist: negar so o alias nao remove nada",
    modo: "denylist",
    segmentos: [canonico(POSTO), alias(POSTO_COMBUSTIVEL, POSTO)],
    regras: [nega(POSTO_COMBUSTIVEL)],
  },
  {
    nome: "modo all aceita canonico e alias, sem vinculo",
    modo: "all",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA), canonico(POSTO)],
    regras: [],
  },
  {
    nome: "modo all nao ressuscita inativo",
    modo: "all",
    segmentos: [canonico(PADARIA), canonico(POSTO, false)],
    regras: [],
  },
  {
    nome: "falha fechada: segmento novo da planilha fica de fora",
    modo: "allowlist",
    segmentos: [canonico(FARMACIA), canonico(NOVO)],
    regras: [permite(FARMACIA)],
  },
  {
    nome: "allowlist sem regra nenhuma",
    modo: "allowlist",
    segmentos: [canonico(PADARIA), alias(CONFEITARIA, PADARIA)],
    regras: [],
  },
  {
    nome: "lista de segmentos vazia",
    modo: "allowlist",
    segmentos: [],
    regras: [permite(PADARIA)],
  },
  {
    nome: "todos inativos",
    modo: "all",
    segmentos: [canonico(PADARIA, false), alias(CONFEITARIA, PADARIA, false)],
    regras: [],
  },
];
