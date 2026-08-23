"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h2)] font-semibold text-[var(--vg-ink)]">
          Algo falhou ao carregar
        </h1>
        <p className="mt-2 text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
          A página não conseguiu ser exibida. Tente de novo; se continuar, avise o suporte
          técnico com o horário em que aconteceu.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-11 rounded-[var(--vg-radius-md)] bg-[var(--vg-brand-500)] px-4 text-[length:var(--vg-text-body)] font-medium text-[var(--vg-ink-on-brand)]"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
