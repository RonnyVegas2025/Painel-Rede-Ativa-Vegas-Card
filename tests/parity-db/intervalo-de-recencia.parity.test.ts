/**
 * Paridade do INTERVALO contra a classificação SQL, sobre a base real.
 *
 * ## O que esta verificação protege, e nenhuma outra protege
 *
 * `tests/unit/intervalo-de-recencia.test.ts` compara o intervalo com a gêmea
 * **TypeScript**. Se as duas divergissem juntas do SQL, ele passaria — e o
 * filtro da listagem entregaria um conjunto e o rótulo diria outro.
 *
 * Aqui a comparação é contra `public.calculate_transaction_status`, que é quem
 * classifica no banco, sobre as linhas que existem de verdade. As duas respostas
 * têm de ser o MESMO CONJUNTO DE IDs — não contagens iguais, que coincidiriam por
 * acaso com uma troca simétrica entre faixas vizinhas.
 *
 * ## Por que o teste semeia os próprios dados
 *
 * A primeira versão exigia a base importada e falhava dizendo "base local vazia".
 * Estava certa quanto à vacuidade e errada quanto à forma: ficaria vermelha em
 * todo banco recém-instalado — motivo legítimo e rotineiro, que é como teste
 * aprende a ser ignorado (PLATFORM-STANDARDS §8).
 *
 * Então ele SEMEIA linhas nas fronteiras (0, 1, 29, 30, 31, 59, 60, 61, 89, 90, 91
 * dias, mais uma data futura) dentro de uma transação que é revertida no fim. As
 * linhas reais que existirem entram na comparação junto — numa base importada o
 * teste cobre as 1.804 também, sem depender delas.
 */
import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { TRANSACTION_STATUS, type TransactionStatus } from "@/constants/transaction-status";
import { intervaloDeRecencia } from "@/lib/business-rules/intervalo-de-recencia";

const CONEXAO = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const FAIXAS: readonly TransactionStatus[] = [
  TRANSACTION_STATUS.RECENTE,
  TRANSACTION_STATUS.ATENCAO,
  TRANSACTION_STATUS.ACAO_NECESSARIA,
  TRANSACTION_STATUS.CRITICO,
];

describe("intervalo de recência × classificação SQL", () => {
  it("selecionam exatamente os mesmos estabelecimentos", async () => {
    const c = new Client({ connectionString: CONEXAO });
    await c.connect();
    try {
      // Os limites vêm do banco, não de constante do teste: se alguém mudar
      // `transaction_recent_days` em system_settings, os dois lados têm de mudar
      // juntos — e é justamente isso que se quer verificar.
      const { rows: cfg } = await c.query(`
        select key, (value #>> '{}')::int v from public.system_settings
         where key in ('transaction_recent_days','transaction_attention_days','transaction_action_days')`);
      const m = new Map(cfg.map((r) => [r.key, r.v]));
      const limites = {
        recentDays: m.get("transaction_recent_days")!,
        attentionDays: m.get("transaction_attention_days")!,
        actionDays: m.get("transaction_action_days")!,
      };

      // Transação revertida no fim: as linhas semeadas não sobram no banco de
      // quem rodou o teste.
      await c.query("begin");

      // As fronteiras, e os vizinhos de cada uma. `-2` é data futura: erro de
      // digitação na planilha, que a regra trata como recente.
      const OFFSETS = [
        -2, 0, 1, 2, 29, 30, 31, 32, 58, 59, 60, 61, 62, 88, 89, 90, 91, 92, 200, 900,
      ];
      for (const [n, dias] of OFFSETS.entries()) {
        await c.query(
          `insert into public.establishments
             (external_contract, legal_name, trade_name, last_transaction_at, never_transacted)
           values ($1, $2, $2,
                   date_trunc('day', now() at time zone 'America/Sao_Paulo')
                     at time zone 'America/Sao_Paulo'
                     - make_interval(days => $3) + interval '11 hours',
                   false)`,
          [`PARIDADE-${n}`, `PARIDADE ${dias} dias`, dias],
        );
      }

      const { rows: total } = await c.query(
        `select count(*)::int n from public.establishments where is_active and not never_transacted`,
      );
      // Não pode ser vácuo: sem linha nenhuma, comparar conjunto vazio com
      // conjunto vazio é o tipo de verde que não significa nada.
      expect(total[0].n, "as linhas semeadas não entraram").toBeGreaterThanOrEqual(OFFSETS.length);

      // `agora` vem do BANCO. Usar o relógio do Node compararia dois instantes
      // diferentes, e uma divergência na virada do dia seria lida como defeito.
      const { rows: r } = await c.query(`select now() as agora`);
      const agora: Date = r[0].agora;

      for (const faixa of FAIXAS) {
        const i = intervaloDeRecencia(faixa, limites, agora);

        const { rows: porSql } = await c.query(
          `select id from public.establishments
            where is_active and not never_transacted
              and public.calculate_transaction_status(last_transaction_at, $1, $2, $3) = $4
            order by id`,
          [limites.recentDays, limites.attentionDays, limites.actionDays, faixa],
        );

        const { rows: porIntervalo } = await c.query(
          `select id from public.establishments
            where is_active and not never_transacted
              and ($1::timestamptz is null or last_transaction_at >= $1)
              and ($2::timestamptz is null or last_transaction_at <  $2)
            order by id`,
          [i.desde, i.ate],
        );

        const sql = new Set(porSql.map((x) => x.id));
        const intervalo = new Set(porIntervalo.map((x) => x.id));
        const soNoSql = [...sql].filter((x) => !intervalo.has(x));
        const soNoIntervalo = [...intervalo].filter((x) => !sql.has(x));

        expect(
          { faixa, soNoSql: soNoSql.slice(0, 3), soNoIntervalo: soNoIntervalo.slice(0, 3) },
          `divergência em ${faixa}: SQL ${sql.size} · intervalo ${intervalo.size}`,
        ).toEqual({ faixa, soNoSql: [], soNoIntervalo: [] });
      }

      // Cobertura: as quatro faixas mais os nunca-transacionaram têm de somar a
      // base ativa inteira. Buraco faria um estabelecimento sumir de todos os
      // filtros — e sumir da lista é indistinguível de não existir.
      const { rows: soma } = await c.query(`
        select count(*)::int n from public.establishments where is_active`);
      const { rows: nunca } = await c.query(`
        select count(*)::int n from public.establishments where is_active and never_transacted`);
      let cobertos = nunca[0].n;
      for (const faixa of FAIXAS) {
        const i = intervaloDeRecencia(faixa, limites, agora);
        const { rows } = await c.query(
          `select count(*)::int n from public.establishments
            where is_active and not never_transacted
              and ($1::timestamptz is null or last_transaction_at >= $1)
              and ($2::timestamptz is null or last_transaction_at <  $2)`,
          [i.desde, i.ate],
        );
        cobertos += rows[0].n;
      }
      expect(cobertos, "as faixas não cobrem a base inteira").toBe(soma[0].n);

      // Cada fronteira semeada caiu em exatamente uma faixa — verificado acima
      // pela igualdade de conjuntos, que inclui estas linhas.
      const { rows: semeadas } = await c.query(
        `select count(*)::int n from public.establishments where external_contract like 'PARIDADE-%'`,
      );
      expect(semeadas[0].n).toBe(OFFSETS.length);
    } finally {
      await c.query("rollback").catch(() => {});
      await c.end();
    }
  });
});
