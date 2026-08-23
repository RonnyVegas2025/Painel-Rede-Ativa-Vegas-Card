import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { APP } from "@/constants/app";
import { LoginForm } from "@/features/autenticacao/components/formulario-login";

export const metadata: Metadata = { title: `Entrar · ${APP.name}` };

/**
 * §7: layout oficial de login da plataforma. Painel institucional à esquerda
 * (~44% no desktop), autenticação à direita, faixa de gradiente no topo.
 * A estrutura permanece igual entre sistemas Vegas; mudam nome, texto
 * institucional, versão e recursos de autenticação — todos em constants/app.ts.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Assinatura institucional: faixa fina, nunca área grande (§3.2). */}
      <div aria-hidden="true" className="faixa-gradiente h-1 w-full md:w-[44%]" />

      <div className="flex flex-1 flex-col md:flex-row">
        {/* Painel institucional — oculto no mobile (§7). */}
        <aside className="sobre-marca hidden w-[44%] flex-col justify-end bg-[var(--vg-brand-700)] p-10 md:flex lg:p-14">
          <h2 className="max-w-md font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-display-xl)] leading-[var(--vg-leading-display-xl)] font-medium text-[var(--vg-ink-on-brand)]">
            {APP.name}
          </h2>
          <p className="mt-5 max-w-md text-[length:var(--vg-text-body)] leading-[var(--vg-leading-body)] text-[var(--vg-ink-on-brand-secondary)]">
            {APP.institutional}
          </p>
          <p className="mt-10 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-on-brand-secondary)]">
            {APP.owner}
          </p>
        </aside>

        {/* Área de autenticação. */}
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 flex flex-col items-center text-center">
              <Logo variant="full" className="h-[74px]" />
              <h1 className="mt-6 font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h1)] leading-[var(--vg-leading-h1)] font-medium text-[var(--vg-ink)]">
                {APP.name}
              </h1>
              <p className="mt-2 text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
                {APP.loginHint}
              </p>
            </div>

            {motivo === "inativo" && (
              <p
                role="alert"
                className="mb-6 rounded-[var(--vg-radius-md)] border border-[var(--vg-danger-fg)] bg-[var(--vg-danger-bg)] p-3 text-[length:var(--vg-text-body)] text-[var(--vg-danger-fg)]"
              >
                Este acesso está desativado. Fale com o gestor da rede.
              </p>
            )}
            {motivo === "link_invalido" && (
              <p
                role="alert"
                className="mb-6 rounded-[var(--vg-radius-md)] border border-[var(--vg-warning-fg)] bg-[var(--vg-warning-bg)] p-3 text-[length:var(--vg-text-body)] text-[var(--vg-warning-fg)]"
              >
                O link expirou ou já foi utilizado. Entre com e-mail e senha.
              </p>
            )}

            <LoginForm />

            <p className="mt-10 text-center text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
              {APP.owner} · {APP.version}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
