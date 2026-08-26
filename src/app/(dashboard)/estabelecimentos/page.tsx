import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import type { TransactionStatus } from "@/constants/transaction-status";
import type { OperationalStatus } from "@/constants/operational-status";
import type { RegistrationStatus } from "@/constants/establishment-status";
import { POR_PAGINA, listar, lerOpcoes } from "@/features/estabelecimentos/services/listagem";
import { DimensoesEmLinha } from "@/features/estabelecimentos/components/dimensoes";
import { Filtros } from "@/features/estabelecimentos/components/filtros";

export const metadata: Metadata = { title: "Estabelecimentos · Rede Vegas Ativa" };

const nf = (n: number) => n.toLocaleString("pt-BR");

export default async function EstabelecimentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission("estabelecimentos.ler");

  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina ?? "1") || 1);
  const filtros = {
    busca: sp.busca?.trim() || null,
    transacional: (sp.transacional as TransactionStatus) || null,
    operacional: (sp.operacional as OperationalStatus) || null,
    cadastral: (sp.cadastral as RegistrationStatus) || null,
    segmentoId: sp.segmento || null,
    cidade: sp.cidade || null,
    ausentes: sp.ausentes === "1",
    ordem: (sp.ordem as "recentes" | "antigos" | "nome") || "recentes",
  };

  const [{ linhas, total }, opcoes] = await Promise.all([listar(filtros, pagina), lerOpcoes()]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const url = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina") q.set(k, v);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return `${ROUTES.ESTABELECIMENTOS}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Estabelecimentos"
        description={`${nf(total)} ${total === 1 ? "ponto credenciado" : "pontos credenciados"}`}
      />

      <Filtros opcoes={opcoes} atual={sp} />

      {linhas.length === 0 ? (
        <EmptyState
          title="Nenhum estabelecimento encontrado"
          description="Ajuste os filtros, ou importe a planilha se a base ainda estiver vazia."
        />
      ) : (
        <Card className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[length:var(--vg-text-body-sm)]">
              <thead className="bg-[var(--vg-surface-muted)] text-[var(--vg-ink-secondary)]">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Estabelecimento</th>
                  <th scope="col" className="px-3 py-2 font-medium">Segmento</th>
                  <th scope="col" className="px-3 py-2 font-medium">Local</th>
                  {/* As cinco dimensões, separadas — ADR 0004. Reduzi-las a uma
                      coluna "status" recriaria o campo genérico que a Sprint 0
                      recusou. */}
                  <th scope="col" className="px-3 py-2 font-medium">Cadastral · Transacional · Operacional</th>
                  <th scope="col" className="px-3 py-2 font-medium">Última transação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--vg-border)]">
                    <td className="px-3 py-2">
                      <Link
                        href={`${ROUTES.ESTABELECIMENTOS}/${e.id}`}
                        className="text-[var(--vg-brand-500)] underline underline-offset-2"
                      >
                        {e.tradeName}
                      </Link>
                      <p className="text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                        {e.externalContract ?? "sem contrato"}
                        {e.absentSince ? " · ausente na última importação" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">{e.segmento ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">
                      {e.bairro ? `${e.bairro} · ` : ""}
                      {e.cidade ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <DimensoesEmLinha
                        d={{
                          cadastral: e.cadastral,
                          transacional: e.transacional,
                          operacional: e.operacional,
                          visita: e.visita,
                          ocorrencia: e.ocorrencia,
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-[var(--vg-ink-secondary)] [font-variant-numeric:tabular-nums]">
                      {e.neverTransacted
                        ? "nunca"
                        : e.lastTransactionAt
                          ? new Date(e.lastTransactionAt).toLocaleDateString("pt-BR")
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginas > 1 ? (
            <nav
              aria-label="Paginação"
              className="mt-4 flex items-center justify-between text-[length:var(--vg-text-body-sm)]"
            >
              {pagina > 1 ? (
                <Link href={url(pagina - 1)} className="underline underline-offset-2">Anterior</Link>
              ) : (<span />)}
              <span className="text-[var(--vg-ink-secondary)]">
                Página {pagina} de {nf(paginas)} · {nf(total)} no filtro
              </span>
              {pagina < paginas ? (
                <Link href={url(pagina + 1)} className="underline underline-offset-2">Próxima</Link>
              ) : (<span />)}
            </nav>
          ) : null}
        </Card>
      )}
    </div>
  );
}
