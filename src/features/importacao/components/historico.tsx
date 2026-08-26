import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BadgeTone } from "@/constants/badge-tones";
import type { ImportJobStatus, JobConcluido } from "@/features/importacao/services/jobs";

const TOM: Partial<Record<ImportJobStatus, BadgeTone>> = {
  concluida: "success",
  cancelada: "neutral",
  falhou: "danger",
};

const nf = (n: number) => n.toLocaleString("pt-BR");
const dt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/**
 * O que ENTROU na base — a prévia é sobre o que vai entrar.
 *
 * Descartadas aparecem junto, e é de propósito: o motivo do descarte é o registro
 * de que alguém tentou importar algo estranho, e é isso que se quer olhar depois.
 */
export function Historico({ jobs }: { jobs: readonly JobConcluido[] }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <p className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          Nenhuma importação concluída ou descartada.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[length:var(--vg-text-body-sm)]">
          <thead className="bg-[var(--vg-surface-muted)] text-[var(--vg-ink-secondary)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Arquivo</th>
              <th scope="col" className="px-3 py-2 font-medium">Estado</th>
              <th scope="col" className="px-3 py-2 font-medium">Novos</th>
              <th scope="col" className="px-3 py-2 font-medium">Atualizados</th>
              <th scope="col" className="px-3 py-2 font-medium">Intocados</th>
              <th scope="col" className="px-3 py-2 font-medium">Conflitos</th>
              <th scope="col" className="px-3 py-2 font-medium">Ausentes</th>
              <th scope="col" className="px-3 py-2 font-medium">Quando</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-[var(--vg-border)]">
                <td className="px-3 py-2 text-[var(--vg-ink)]">
                  {j.fileName}
                  <span className="block text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                    {j.scopeCity ?? "sem escopo"}
                    {j.derivadoDeId ? " · redeclarada" : ""}
                    {/* A confirmação deliberada fica registrada: é o rastro de que
                        alguém aprovou uma importação acima do limiar. */}
                    {j.confirmedAt ? " · confirmada acima do limiar" : ""}
                  </span>
                  {j.errorMessage && j.status !== "concluida" ? (
                    <span className="block text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                      {j.errorMessage}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={TOM[j.status] ?? "neutral"}>{j.status}</Badge>
                </td>
                <td className="px-3 py-2 [font-variant-numeric:tabular-nums]">{nf(j.createdCount)}</td>
                <td className="px-3 py-2 [font-variant-numeric:tabular-nums]">{nf(j.updatedCount)}</td>
                <td className="px-3 py-2 [font-variant-numeric:tabular-nums]">{nf(j.unchangedCount)}</td>
                <td className="px-3 py-2 [font-variant-numeric:tabular-nums]">{nf(j.conflictCount)}</td>
                <td className="px-3 py-2 [font-variant-numeric:tabular-nums]">{nf(j.missingCount)}</td>
                <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">{dt(j.finishedAt ?? j.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
