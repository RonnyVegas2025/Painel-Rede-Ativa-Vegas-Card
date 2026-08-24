import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ROLE_LABELS } from "@/constants/roles";
import { requireProfile } from "@/lib/auth/require-role";
import { getRoleFromClaims } from "@/features/autenticacao/services/auth-service";
import { getSettings } from "@/lib/settings/get-settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Diagnóstico · Rede Vegas Ativa" };

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

function Row({ check }: { check: Check }) {
  return (
    <li className="flex items-start gap-3 border-b border-[var(--vg-border)] py-2 last:border-0">
      <span
        aria-hidden="true"
        className="mt-1.5 size-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor: check.ok ? "var(--vg-success-fg)" : "var(--vg-danger-fg)",
        }}
      />
      <div>
        <p className="text-[length:var(--vg-text-body)] font-medium text-[var(--vg-ink)]">
          {check.label}
          <span className="sr-only">: {check.ok ? "funcionando" : "com problema"}</span>
        </p>
        <p className="numerico text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">{check.detail}</p>
      </div>
    </li>
  );
}

/** Verifica a instalação de ponta a ponta: sessão, RLS, claim, catálogo, parâmetros. */
export default async function DiagnosticoPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [claimRole, settings, produtos, segmentos, elegibilidade, parametros] =
    await Promise.all([
      getRoleFromClaims(),
      getSettings(),
      supabase.from("card_products").select("id", { count: "exact", head: true }),
      supabase.from("segments").select("id", { count: "exact", head: true }),
      supabase.from("product_segments").select("id", { count: "exact", head: true }),
      // Conta as linhas reais. getSettings sempre devolve 7 chaves por causa do
      // fallback, entao contar o retorno dele passaria mesmo com o banco vazio.
      supabase.from("system_settings").select("key", { count: "exact", head: true }),
    ]);

  const claimOk = claimRole === profile.role;

  const checks: Check[] = [
    {
      label: "Sessão ativa",
      ok: true,
      detail: `${profile.email} · ${ROLE_LABELS[profile.role]}`,
    },
    {
      label: "Papel no token (JWT)",
      ok: claimOk,
      detail: claimOk
        ? `Claim e perfil coincidem: ${claimRole}`
        : `Claim "${claimRole ?? "ausente"}" difere do perfil "${profile.role}". O token é anterior à mudança de papel — encerre a sessão e entre de novo.`,
    },
    {
      label: "Modalidades",
      ok: (produtos.count ?? 0) > 0,
      detail: `${produtos.count ?? 0} cadastradas`,
    },
    {
      label: "Segmentos",
      // Vazio antes da primeira importacao e o estado CORRETO: segments nao e
      // semeado, porque os valores reais de Subgrupo vem da planilha e sao a
      // chave de reconciliacao. Marcar vermelho aqui faria uma instalacao nova
      // parecer quebrada.
      ok: true,
      detail:
        (segmentos.count ?? 0) > 0
          ? `${segmentos.count ?? 0} cadastrados`
          : "nenhum ainda — populados pela primeira importação, não por seed",
    },
    {
      label: "Regras de elegibilidade",
      ok: true,
      detail:
        (elegibilidade.count ?? 0) > 0
          ? `${elegibilidade.count ?? 0} vínculos · Vegas Day e Plus não usam vínculo (modo all)`
          : "nenhuma ainda — criadas em /produtos depois de a fila de /segmentos ser resolvida",
    },
    {
      label: "Parâmetros operacionais",
      ok: (parametros.count ?? 0) === 7,
      detail:
        (parametros.count ?? 0) === 7
          ? "7 de 7 carregados do banco"
          : `${parametros.count ?? 0} de 7 no banco — os valores exibidos abaixo são de fallback, não os configurados. Rode o seed.`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={[{ label: "Painel", href: "/dashboard" }, { label: "Diagnóstico" }]}
        title="Diagnóstico"
        description="Verificação da instalação: sessão, permissões e dados de base."
      />

      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Verificações</CardTitle>
        </CardHeader>
        <ul>
          {checks.map((check) => (
            <Row key={check.label} check={check} />
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros em vigor</CardTitle>
        </CardHeader>
        <dl className="space-y-1.5 text-[length:var(--vg-text-body)]">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-[var(--vg-ink-secondary)]">{key}</dt>
              <dd className="identificador text-[var(--vg-ink)]">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      </div>
    </div>
  );
}
