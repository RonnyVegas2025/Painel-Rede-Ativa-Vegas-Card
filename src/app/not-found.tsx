import Link from "next/link";
import { ROUTES } from "@/constants/routes";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h2)] font-semibold text-[var(--vg-ink)]">
          Página não encontrada
        </h1>
        <p className="mt-2 text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link
          href={ROUTES.DASHBOARD}
          className="mt-6 inline-flex h-11 items-center rounded-[var(--vg-radius-md)] bg-[var(--vg-brand-500)] px-4 text-[length:var(--vg-text-body)] font-medium text-[var(--vg-ink-on-brand)]"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
