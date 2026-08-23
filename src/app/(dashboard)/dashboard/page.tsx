import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES } from "@/constants/routes";
import { ROLE_LABELS } from "@/constants/roles";
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUS_TONES,
  type TransactionStatus,
} from "@/constants/transaction-status";
import { requireProfile } from "@/lib/auth/require-role";
import { getSettings } from "@/lib/settings/get-settings";

export const metadata: Metadata = { title: "Painel · Rede Vegas Ativa" };

const RAMP: readonly TransactionStatus[] = [
  "recente", "atencao", "acao_necessaria", "critico", "nunca_transacionou",
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const [profile, settings, { erro }] = await Promise.all([
    requireProfile(),
    getSettings(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      {erro === "sem_permissao" && (
        <p
          role="alert"
          className="mb-6 rounded-[var(--vg-radius-md)] border border-[var(--vg-danger-fg)] bg-[var(--vg-danger-bg)] p-3 text-[length:var(--vg-text-body)] text-[var(--vg-danger-fg)]"
        >
          Seu perfil não tem permissão para acessar aquela área.
        </p>
      )}

      <PageHeader
        breadcrumb={[{ label: "Painel" }]}
        title={`Olá, ${profile.fullName.split(" ")[0]}`}
        description={`Perfil ${ROLE_LABELS[profile.role]}. A rede aparece aqui depois da primeira importação.`}
      />

      <div className="space-y-6">
        <EmptyState
          title="A rede ainda não foi importada"
          description="Os indicadores aparecem depois da primeira importação da base de estabelecimentos, prevista para a próxima etapa."
          action={
            <Link
              href={ROUTES.DIAGNOSTICO}
              className="text-[length:var(--vg-text-body)] font-medium text-[var(--vg-brand-500)] underline underline-offset-4"
            >
              Ver diagnóstico da instalação
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Faixas de recência configuradas</CardTitle>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {RAMP.map((status) => (
              <StatusBadge
                key={status}
                dimension="Transacional"
                label={TRANSACTION_STATUS_LABELS[status]}
                tone={TRANSACTION_STATUS_TONES[status]}
              />
            ))}
          </div>
          <p className="numerico mt-4 text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
            Recente até {settings.transaction_recent_days} dias · atenção até{" "}
            {settings.transaction_attention_days} · ação necessária até{" "}
            {settings.transaction_action_days} · acima disso, crítico.
          </p>
        </Card>
      </div>
    </div>
  );
}
