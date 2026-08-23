import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Sempre visível acima do campo (§12). */
export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2 block text-[length:var(--vg-text-body)] font-medium text-[var(--vg-ink)]",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

/** Ajuda contextual e erro ficam no mesmo lugar, abaixo do campo (§12). */
export function FieldHelp({
  children,
  error = false,
  id,
}: {
  children: React.ReactNode;
  error?: boolean;
  id?: string;
}) {
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={cn(
        "mt-1.5 text-[length:var(--vg-text-caption)] leading-[var(--vg-leading-caption)]",
        error ? "text-[var(--vg-danger-fg)]" : "text-[var(--vg-ink-secondary)]",
      )}
    >
      {children}
    </p>
  );
}
