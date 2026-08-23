import { Button } from "./button";

interface ErrorStateProps {
  title: string;
  /** O que aconteceu e o que fazer. Erro não se desculpa e não é vago. */
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-[var(--vg-radius-lg)] border border-[var(--vg-danger-fg)] bg-[var(--vg-danger-bg)] p-4"
    >
      <h3 className="text-[length:var(--vg-text-body)] font-semibold text-[var(--vg-danger-fg)]">
        {title}
      </h3>
      <p className="mt-1 text-[length:var(--vg-text-body)] text-[var(--vg-ink)]">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
