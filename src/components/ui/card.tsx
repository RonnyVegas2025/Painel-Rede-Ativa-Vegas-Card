import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** §10: branco, borda de 1 px, sombra quase imperceptível. Sem gradiente. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--vg-radius-lg)] border border-[var(--vg-border)] bg-[var(--vg-surface)]",
        "p-4 shadow-[var(--vg-shadow-card)] md:p-6",
        className,
      )}
      {...props}
    />
  );
}

/** Título à esquerda, ações à direita (§10). */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)]",
        "leading-[var(--vg-leading-h3)] font-semibold text-[var(--vg-ink)]",
        className,
      )}
      {...props}
    />
  );
}
