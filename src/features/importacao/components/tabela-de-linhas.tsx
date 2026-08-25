import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { BadgeTone } from "@/constants/badge-tones";
import type { ImportRowStatus } from "@/lib/business-rules/classify-import-row";
import type { ContagemPorStatus, LinhaDaPrevia } from "@/features/importacao/services/jobs";

const TOM: Record<string, BadgeTone> = {
  novo: "success",
  atualizado: "info",
  inalterado: "neutral",
  conflito: "warning",
  erro: "danger",
  ausente: "suspended",
};

const ABAS: readonly { chave: ImportRowStatus | null; rotulo: string }[] = [
  { chave: null, rotulo: "Todas" },
  { chave: "novo", rotulo: "Novos" },
  { chave: "atualizado", rotulo: "Atualizados" },
  { chave: "inalterado", rotulo: "Inalterados" },
  { chave: "conflito", rotulo: "Conflitos" },
  { chave: "erro", rotulo: "Erros" },
];

interface Props {
  importId: string;
  linhas: readonly LinhaDaPrevia[];
  total: number;
  pagina: number;
  porPagina: number;
  filtro: ImportRowStatus | null;
  contagens: ContagemPorStatus;
}

/**
 * As linhas, paginadas.
 *
 * 1.804 não cabem numa tela, e a decisão é sobre os agregados — que ficam acima e
 * sempre visíveis. Isto aqui serve para conferir uma suspeita.
 */
export function TabelaDeLinhas({
  importId,
  linhas,
  total,
  pagina,
  porPagina,
  filtro,
  contagens,
}: Props) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const url = (estado: ImportRowStatus | null, p: number) => {
    const q = new URLSearchParams();
    if (estado) q.set("estado", estado);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return `${ROUTES.IMPORTACOES}/${importId}${s ? `?${s}` : ""}`;
  };

  return (
    <Card>
      <nav aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-2">
        {ABAS.map((aba) => {
          const ativo = aba.chave === filtro;
          const n = aba.chave === null ? null : contagens[aba.chave];
          return (
            <Link
              key={aba.rotulo}
              href={url(aba.chave, 1)}
              aria-current={ativo ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-[var(--vg-radius-md)] px-3 text-[length:var(--vg-text-body-sm)] ${
                ativo
                  ? "bg-[var(--vg-brand-500)] text-[var(--vg-ink-on-brand)]"
                  : "border border-[var(--vg-border)] text-[var(--vg-ink-secondary)] hover:bg-[var(--vg-neutral-bg)]"
              }`}
            >
              {aba.rotulo}
              {n !== null ? <span className="ml-1.5">({n.toLocaleString("pt-BR")})</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[length:var(--vg-text-body-sm)]">
          <thead className="bg-[var(--vg-surface-muted)] text-[var(--vg-ink-secondary)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Linha</th>
              <th scope="col" className="px-3 py-2 font-medium">Estado</th>
              <th scope="col" className="px-3 py-2 font-medium">Empresa</th>
              <th scope="col" className="px-3 py-2 font-medium">Contrato</th>
              <th scope="col" className="px-3 py-2 font-medium">Cidade</th>
              <th scope="col" className="px-3 py-2 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.lineNumber} className="border-t border-[var(--vg-border)]">
                <td className="px-3 py-2 text-[var(--vg-ink-secondary)] [font-variant-numeric:tabular-nums]">
                  {l.lineNumber}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={TOM[l.status] ?? "neutral"}>{l.status}</Badge>
                </td>
                <td className="px-3 py-2 text-[var(--vg-ink)]">{l.empresa}</td>
                <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">{l.contrato ?? "—"}</td>
                <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">{l.cidade ?? "—"}</td>
                {/* O conflito diz POR QUÊ. "conflito" sozinho não é acionável. */}
                <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">{l.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linhas.length === 0 ? (
        <p className="py-6 text-center text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          Nenhuma linha neste estado.
        </p>
      ) : null}

      {paginas > 1 ? (
        <nav
          aria-label="Paginação"
          className="mt-4 flex items-center justify-between text-[length:var(--vg-text-body-sm)]"
        >
          {pagina > 1 ? (
            <Link href={url(filtro, pagina - 1)} className="underline underline-offset-2">
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[var(--vg-ink-secondary)]">
            Página {pagina} de {paginas} · {total.toLocaleString("pt-BR")} linhas
          </span>
          {pagina < paginas ? (
            <Link href={url(filtro, pagina + 1)} className="underline underline-offset-2">
              Próxima
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </Card>
  );
}
