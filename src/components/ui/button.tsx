import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "neutral" | "danger" | "text";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Variantes conforme UI Standard §11. Uma primária por área de decisão. */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--vg-brand-500)] text-[var(--vg-ink-on-brand)] hover:bg-[var(--vg-brand-600)] active:bg-[var(--vg-brand-700)] disabled:bg-[var(--vg-border-field)]",
  secondary:
    "bg-[var(--vg-surface)] text-[var(--vg-brand-500)] border border-[var(--vg-border-field)] hover:bg-[var(--vg-brand-50)] active:bg-[var(--vg-brand-100)]",
  neutral:
    "bg-[var(--vg-neutral-bg)] text-[var(--vg-ink)] hover:bg-[var(--vg-border)] active:bg-[var(--vg-border-field)]",
  danger:
    "bg-[var(--vg-danger-fg)] text-[var(--vg-ink-on-brand)] hover:brightness-90 active:brightness-85",
  text: "bg-transparent text-[var(--vg-brand-500)] hover:bg-[var(--vg-brand-50)] active:bg-[var(--vg-brand-100)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[length:var(--vg-text-body-sm)]",
  md: "h-11 px-4 text-[length:var(--vg-text-body)]",
  lg: "h-12 px-6 text-[length:var(--vg-text-body)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--vg-radius-md)] font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
