import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import {
  listarAusentes,
  listarHistorico,
  listarPendentes,
} from "@/features/importacao/services/jobs";
import { ItemPendente } from "@/features/importacao/components/lista-de-pendentes";
import { FilaDeAusentes } from "@/features/importacao/components/fila-de-ausentes";
import { Historico } from "@/features/importacao/components/historico";

export const metadata: Metadata = { title: "Importações · Rede Vegas Ativa" };

/**
 * Importações: pendentes, ausentes e histórico.
 *
 * A **resolução de ausentes** é a parte que a Sprint 1 não fechava sem. O ADR 0011
 * manda o registro ausente para análise administrativa; o E-005 marcava com data e
 * o E-006 mostrava o número — e não havia onde a análise acontecesse. Sem ação, a
 * marca nunca saía: a importação seguinte marcava de novo, e em três meses ninguém
 * distinguiria "sumiu ontem" de "sumiu em março e já foi verificado".
 *
 * Expurgo automático de prévia abandonada continua **fora**, de propósito: prévia
 * abandonada com meses é informação sobre tentativas estranhas, e apagar sozinho o
 * que ninguém olhou perde o rastro. O descarte manual com motivo já existe.
 */
export default async function ImportacoesPage() {
  await requirePermission("importacao.executar");

  const [pendentes, ausentes, historico] = await Promise.all([
    listarPendentes(),
    listarAusentes(null),
    listarHistorico(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Importações"
        description={
          pendentes.length === 0
            ? "Nenhuma importação aguardando decisão."
            : `${pendentes.length} ${pendentes.length === 1 ? "importação pendente" : "importações pendentes"}`
        }
        action={
          <Link
            href={`${ROUTES.IMPORTACOES}/nova`}
            className="inline-flex h-11 items-center rounded-[var(--vg-radius-md)] bg-[var(--vg-brand-500)] px-4 text-[length:var(--vg-text-body)] text-[var(--vg-ink-on-brand)] hover:bg-[var(--vg-brand-600)]"
          >
            <Upload aria-hidden className="mr-2 size-4" />
            Nova importação
          </Link>
        }
      />

      {pendentes.length === 0 ? (
        <EmptyState
          title="Nenhuma importação pendente"
          description="Envie a planilha para gerar uma prévia. Nada entra na base antes de você revisar."
        />
      ) : (
        <div className="space-y-4">
          {pendentes.map((job) => (
            <ItemPendente key={job.id} job={job} />
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h2)] text-[var(--vg-ink)]">
          Ausentes aguardando análise
        </h2>
        <p className="mb-4 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          Registros que estão na base e não vieram no arquivo, dentro do escopo declarado.
          Nada foi excluído. Ordenados por transação mais recente — quem transacionou há
          pouco e sumiu do arquivo é o sinal mais forte de que o escopo estava errado.
        </p>
        <FilaDeAusentes ausentes={ausentes} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h2)] text-[var(--vg-ink)]">
          Histórico
        </h2>
        <Historico jobs={historico} />
      </section>
    </div>
  );
}
