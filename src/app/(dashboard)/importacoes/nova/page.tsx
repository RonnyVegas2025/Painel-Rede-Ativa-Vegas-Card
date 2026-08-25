import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import { FormularioDeImportacao } from "@/features/importacao/components/formulario-de-importacao";

export const metadata: Metadata = { title: "Nova importação · Rede Vegas Ativa" };

export default async function NovaImportacaoPage() {
  await requirePermission("importacao.executar");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        breadcrumb={[{ label: "Importações", href: ROUTES.IMPORTACOES }]}
        title="Nova importação"
        description="A prévia mostra o que vai acontecer. Nada entra na base antes de você aplicar."
      />
      <FormularioDeImportacao />
    </div>
  );
}
