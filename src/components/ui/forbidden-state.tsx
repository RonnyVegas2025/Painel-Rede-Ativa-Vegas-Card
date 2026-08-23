import { Lock } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

/**
 * §16: forbidden state não deve parecer erro técnico.
 * Diz que falta permissão sem descrever o que existe do outro lado — detalhar
 * o recurso protegido para quem não pode vê-lo já é vazamento de informação.
 */
export function ForbiddenState({ resource = "esta área" }: { resource?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--vg-radius-lg)] border border-[var(--vg-border)] bg-[var(--vg-surface)] px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-4 grid size-12 place-items-center rounded-full bg-[var(--vg-neutral-bg)] text-[var(--vg-neutral-fg)]"
      >
        <Lock className="size-5" />
      </span>
      <h3 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] font-semibold text-[var(--vg-ink)]">
        Acesso não autorizado
      </h3>
      <p className="mt-2 max-w-sm text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
        Seu perfil não tem permissão para acessar {resource}. Fale com o gestor da rede se
        precisar desse acesso.
      </p>
      <Link
        href={ROUTES.DASHBOARD}
        className="mt-6 inline-flex h-11 items-center rounded-[var(--vg-radius-md)] border border-[var(--vg-border-field)] px-4 text-[length:var(--vg-text-body)] font-medium text-[var(--vg-brand-500)] transition-colors hover:bg-[var(--vg-brand-50)]"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
