import { cn } from "@/lib/utils/cn";

export type LogoVariant = "full" | "mark" | "mono";

/**
 * §21: logo por componente único, com variantes completa, compacta e
 * monocromática. Nenhuma tela referencia caminho de imagem diretamente.
 *
 * - `full`  — cartão completo com a wordmark, como no logo oficial. Login e
 *             sidebar expandida.
 * - `mark`  — só a silhueta do cartão. Abaixo de ~28 px a wordmark vira mancha,
 *             então a topbar do celular e a sidebar recolhida usam esta.
 * - `mono`  — traço único em currentColor, para superfície escura.
 *
 * Provisório: vetor derivado do PNG oficial. Substituir pelo SVG oficial (§21).
 */
export function Logo({
  variant = "full",
  className,
}: {
  variant?: LogoVariant;
  className?: string;
}) {
  const mono = variant === "mono";
  const stroke = mono ? "currentColor" : "var(--vg-brand-500)";
  const fill = mono ? "currentColor" : "url(#vg-logo-grad)";

  const gradient = (
    <defs>
      <linearGradient id="vg-logo-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--vg-brand-400)" />
        <stop offset="52%" stopColor="var(--vg-rose-400)" />
        <stop offset="100%" stopColor="var(--vg-peach-400)" />
      </linearGradient>
    </defs>
  );

  /** Bloco de gradiente com o corte branco em V, elemento central da marca. */
  const swoosh = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={h * 0.16} fill={fill} opacity={mono ? 0.9 : 1} />
      <path
        d={`M${x + w * 0.14} ${y} Q${x + w * 0.42} ${y + h * 0.62} ${x + w * 0.5} ${y + h}`}
        fill="none"
        stroke="var(--vg-surface)"
        strokeWidth={h * 0.15}
      />
      <path
        d={`M${x + w * 0.58} ${y + h} L${x + w} ${y + h * 0.28}`}
        fill="none"
        stroke="var(--vg-surface)"
        strokeWidth={h * 0.15}
      />
    </>
  );

  if (variant === "mark") {
    return (
      <svg viewBox="0 0 44 30" role="img" aria-label="Vegas" className={cn("h-7 w-auto", className)}>
        {gradient}
        <rect x="1" y="1" width="42" height="28" rx="6" fill="none" stroke={stroke} strokeWidth="1.6" />
        {swoosh(6, 6, 32, 18)}
      </svg>
    );
  }

  // full e mono: cartão com a wordmark dentro da moldura, como o logo oficial.
  return (
    <svg viewBox="0 0 108 74" role="img" aria-label="Vegas" className={cn("h-16 w-auto", className)}>
      {gradient}
      <rect x="2" y="2" width="104" height="70" rx="14" fill="none" stroke={stroke} strokeWidth="2.5" />
      {swoosh(12, 12, 84, 28)}
      <text
        x="54"
        y="62"
        textAnchor="middle"
        fill={stroke}
        fontFamily="var(--vg-font-display)"
        fontSize="24"
        fontWeight="500"
        letterSpacing="-0.5"
      >
        vegas
      </text>
    </svg>
  );
}
