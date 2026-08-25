import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import { listarPendentes } from "@/features/importacao/services/jobs";
import { ItemPendente } from "@/features/importacao/components/lista-de-pendentes";

export const metadata: Metadata = { title: "Importações · Rede Vegas Ativa" };

/**
 * Importações pendentes.
 *
 * ## Escopo desta etapa (E-006)
 *
 * Só o que a revisão da prévia exige: pendentes, com aplicar, descartar e
 * redeclarar. Sem isto não há como chegar à prévia.
 *
 * **Ficam para o E-008**, e estão registrados em `docs/roadmap.md`:
 * histórico de importações concluídas, relatório por estado, e a **resolução de
 * ausentes** — a fila administrativa que o ADR 0011 prevê e que hoje não tem onde
 * acontecer. A Sprint 1 não fecha sem ela.
 */
export default async function ImportacoesPage() {
  await requirePermission("importacao.executar");

  const pendentes = await listarPendentes();

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
    </div>
  );
}
