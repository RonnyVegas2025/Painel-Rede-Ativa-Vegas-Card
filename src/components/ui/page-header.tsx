import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumb?: readonly Crumb[];
  title: string;
  description?: string;
  /** Ação primária, no canto direito. Uma por área de decisão (§11). */
  action?: ReactNode;
}

/**
 * §8: breadcrumb → título H1 → descrição → ação primária.
 * A ordem entre breadcrumb e título nunca se inverte.
 */
export function PageHeader({ breadcrumb, title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Trilha de navegação" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-[length:var(--vg-text-caption)] leading-[var(--vg-leading-caption)] text-[var(--vg-ink-secondary)]">
            {breadcrumb.map((crumb, index) => {
              const last = index === breadcrumb.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.href && !last ? (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-[var(--vg-brand-500)]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined}>{crumb.label}</span>
                  )}
                  {!last && <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h1)] leading-[var(--vg-leading-h1)] font-semibold text-[var(--vg-ink)]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
