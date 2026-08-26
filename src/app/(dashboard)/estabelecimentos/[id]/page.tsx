import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import { lerFicha } from "@/features/estabelecimentos/services/ficha";
import { DimensoesEmBloco } from "@/features/estabelecimentos/components/dimensoes";

export const metadata: Metadata = { title: "Estabelecimento · Rede Vegas Ativa" };

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("estabelecimentos.ler");
  const { id } = await params;
  const f = await lerFicha(id);
  if (!f) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        breadcrumb={[{ label: "Estabelecimentos", href: ROUTES.ESTABELECIMENTOS }]}
        title={f.tradeName}
        description={f.legalName !== f.tradeName ? f.legalName : undefined}
      />

      {f.absentSince ? (
        <p className="mb-6 flex items-center gap-2 rounded-[var(--vg-radius-md)] border border-[var(--vg-warning-fg)] bg-[var(--vg-warning-bg)] p-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-warning-fg)]">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          Não veio na importação desde {data(f.absentSince)}. Nada foi excluído — o registro
          aguarda análise administrativa.
        </p>
      ) : null}

      {/* As cinco dimensões lado a lado. Visita e ocorrência com `—`: existem no
          modelo, e a Sprint 3 preenche em vez de redesenhar. */}
      <Card className="mb-6">
        <DimensoesEmBloco
          d={{
            cadastral: f.cadastral,
            transacional: f.transacional,
            operacional: f.operacional,
            visita: f.visita,
            ocorrencia: f.ocorrencia,
          }}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
            Identificação
          </h2>
          <Lista
            itens={[
              ["Contrato", f.externalContract ?? "—"],
              ["CNPJ", f.cnpj ?? "não informado ou fora do padrão"],
              ["Segmento", f.segmento ?? "—"],
              // O valor cru é a chave de reconciliação da próxima importação:
              // vê-lo é o que permite entender por que a fila tem o item que tem.
              ["Segmento na origem", f.segmentoCru ?? "—"],
              ["Origem", f.origin ?? "—"],
              ["Canal de credenciamento", f.acquisitionChannel ?? "—"],
              ["Relacionamento desde", data(f.relationshipStartDate)],
            ]}
          />
        </Card>

        <Card>
          <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
            Contato e endereço
          </h2>
          <Lista
            itens={[
              ["Telefone", f.phone ?? "—"],
              ["E-mail", f.email ?? "—"],
              ["Endereço", f.endereco?.bruto ?? "—"],
              ["Bairro", f.endereco?.bairro ?? "—"],
              ["CEP", f.endereco?.cep ?? "—"],
              ["Cidade", f.endereco ? `${f.endereco.cidade} · ${f.endereco.estado}` : "—"],
            ]}
          />
        </Card>

        <Card>
          <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
            Transação
          </h2>
          <Lista
            itens={[
              ["Última transação", f.neverTransacted ? "nunca transacionou" : data(f.lastTransactionAt)],
              [
                "Dias sem transação",
                f.neverTransacted
                  ? "—"
                  : f.diasSemTransacao === null
                    ? "sem data"
                    : String(f.diasSemTransacao),
              ],
            ]}
          />
        </Card>

        <Card>
          <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
            Meios de captura
          </h2>
          {f.pontos.length === 0 ? (
            <p className="mt-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
              Nenhum meio registrado.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-[length:var(--vg-text-body-sm)]">
              {f.pontos.map((p, i) => (
                <li key={`${p.meio}-${i}`} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--vg-ink)]">{p.meio ?? "sem meio"}</span>
                  {p.status === "ativo" ? (
                    <Badge tone="success">ativo</Badge>
                  ) : (
                    // Inativo COM data: o meio que sumiu do arquivo não é apagado,
                    // e é isso que a Sprint 7 olha ao abrir atendimento.
                    <span className="text-[var(--vg-ink-secondary)]">
                      {p.status}
                      {p.inactivatedAt ? ` desde ${data(p.inactivatedAt)}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
            Carteira
          </h2>
          <Lista
            itens={[
              // Texto CRU. Casar nome com `profiles` automaticamente é fonte
              // clássica de atribuição errada, e aqui a atribuição decide quem
              // visita o quê. O vínculo real é da Sprint 3.
              ["Consultores na origem", f.assignedConsultantsRaw ?? "—"],
              ["Descrição", f.description ?? "—"],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function Lista({ itens }: { itens: readonly (readonly [string, string])[] }) {
  return (
    <dl className="mt-3 space-y-2 text-[length:var(--vg-text-body-sm)]">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--vg-ink-secondary)]">{rotulo}</dt>
          <dd className="text-right text-[var(--vg-ink)]">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
