import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Identificador conferido contra a fachada: CNPJ, contrato, terminal. */
  identifier?: boolean;
  invalid?: boolean;
}

/**
 * Borda em --vg-border-field (§3.1 e §12): 3,11:1 contra branco. O token
 * anterior media 1,64:1 e deixava o campo praticamente sem contorno.
 * O rótulo é sempre visível — placeholder nunca substitui label.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, identifier = false, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-12 w-full rounded-[var(--vg-radius-md)] border bg-[var(--vg-surface)] px-3.5",
        "text-[length:var(--vg-text-body)] text-[var(--vg-ink)]",
        "placeholder:text-[var(--vg-ink-secondary)] placeholder:opacity-70",
        "border-[var(--vg-border-field)] transition-colors",
        "hover:border-[var(--vg-brand-400)]",
        "disabled:cursor-not-allowed disabled:bg-[var(--vg-surface-muted)] disabled:opacity-70",
        invalid && "border-[var(--vg-danger-fg)]",
        identifier && "identificador",
        className,
      )}
      {...props}
    />
  );
});
