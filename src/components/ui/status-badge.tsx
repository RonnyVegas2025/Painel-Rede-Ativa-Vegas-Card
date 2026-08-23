import type { BadgeTone } from "@/constants/badge-tones";
import { Badge } from "./badge";

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
  /** Nome da dimensão: "Transacional", "Operacional". Sem isso o rótulo fica ambíguo. */
  dimension?: string;
  className?: string;
}

/**
 * Rótulo de status, sempre com texto.
 *
 * A cor é reforço, nunca o único canal (§14 e §20): verde, laranja e vermelho
 * são indistinguíveis para parte dos usuários, e o consultor costuma estar sob
 * sol com o brilho no máximo.
 */
export function StatusBadge({ label, tone, dimension, className }: StatusBadgeProps) {
  return (
    <Badge tone={tone} className={className} title={dimension ? `${dimension}: ${label}` : label}>
      {dimension && <span className="sr-only">{dimension}: </span>}
      {label}
    </Badge>
  );
}
