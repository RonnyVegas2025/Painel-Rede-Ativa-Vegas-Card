/** Formatacao para exibicao. O dado e guardado sem mascara. */

export function formatCnpj(digits: string | null): string {
  if (!digits || digits.length !== 14) return "—";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatCep(digits: string | null): string {
  if (!digits || digits.length !== 8) return "—";
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatPhone(digits: string | null): string {
  if (!digits) return "—";
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : DATE_FMT.format(date);
}

export function formatDays(days: number | null): string {
  if (days === null) return "Nunca transacionou";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `${days} dias`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
