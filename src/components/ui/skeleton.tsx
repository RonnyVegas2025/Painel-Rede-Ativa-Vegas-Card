import { cn } from "@/lib/utils/cn";

/** §16: usar quando a estrutura da tela já é conhecida. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[var(--vg-radius-md)] bg-[var(--vg-border)]", className)}
    />
  );
}
