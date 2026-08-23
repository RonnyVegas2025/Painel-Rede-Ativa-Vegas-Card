import type { HTMLAttributes } from "react";
import type { BadgeTone } from "@/constants/badge-tones";
import { cn } from "@/lib/utils/cn";

export type { BadgeTone };

const TONES: Record<BadgeTone, string> = {
  success: "bg-[var(--vg-success-bg)] text-[var(--vg-success-fg)]",
  warning: "bg-[var(--vg-warning-bg)] text-[var(--vg-warning-fg)]",
  danger: "bg-[var(--vg-danger-bg)] text-[var(--vg-danger-fg)]",
  info: "bg-[var(--vg-info-bg)] text-[var(--vg-info-fg)]",
  neutral: "bg-[var(--vg-neutral-bg)] text-[var(--vg-neutral-fg)]",
  partial: "bg-[var(--vg-partial-bg)] text-[var(--vg-partial-fg)]",
  suspended: "bg-[var(--vg-suspended-bg)] text-[var(--vg-suspended-fg)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Escala semântica do §14. Marca e status não compartilham significado. */
export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--vg-radius-pill)] px-2.5 py-1",
        "text-[length:var(--vg-text-caption)] leading-[var(--vg-leading-caption)] font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
