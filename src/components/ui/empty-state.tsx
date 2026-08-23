import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  /** §16: explicar por que não há dados e qual é o próximo passo. */
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--vg-radius-lg)] border border-dashed border-[var(--vg-border-field)] bg-[var(--vg-surface)] px-6 py-12 text-center">
      <h3 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] leading-[var(--vg-leading-h3)] font-semibold text-[var(--vg-ink)]">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
