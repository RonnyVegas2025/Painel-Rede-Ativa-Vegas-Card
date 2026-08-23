/**
 * Normalizacao de endereco usada no hash de identidade (ADR 0001) e na
 * deduplicacao da fila de geocodificacao (ADR 0006).
 *
 * ESTA FUNCAO E CONGELADA. O hash dela e chave persistida: mudar a normalizacao
 * exige migracao de dados, senao registros existentes deixam de casar. O teste de
 * regressao existe para tornar a mudanca acidental visivel.
 */
const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bav\b\.?/g, "avenida"],
  [/\br\b\.?/g, "rua"],
  [/\bpc\b\.?|\bpca\b\.?/g, "praca"],
  [/\brod\b\.?/g, "rodovia"],
  [/\bestr\b\.?/g, "estrada"],
  [/\btrav\b\.?|\btv\b\.?/g, "travessa"],
  [/\bal\b\.?/g, "alameda"],
  [/\bjd\b\.?/g, "jardim"],
  [/\bvl\b\.?/g, "vila"],
  [/\bpq\b\.?/g, "parque"],
  [/\bs\/n\b|\bsn\b/g, "sn"],
  [/\bapto\b\.?|\bap\b\.?/g, "apartamento"],
];

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAddress(raw: string, cep?: string | null): string {
  let out = stripDiacritics(raw.toLowerCase());
  out = out.replace(/[.,;:]/g, " ");
  for (const [pattern, replacement] of ABBREVIATIONS) {
    out = out.replace(pattern, replacement);
  }
  // Hifen e barra viram espaco: "Rua A, 10 - Centro" e "Rua A 10 Centro" sao o mesmo
  // endereco e precisam gerar o mesmo hash. "s/n" ja virou "sn" acima.
  out = out.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const digits = (cep ?? "").replace(/\D/g, "");
  return digits.length === 8 ? `${out} ${digits}` : out;
}

export function normalizeCnpj(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

export function normalizeCep(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

/** Data DD/MM/AAAA da planilha. Meio-dia UTC evita o dia virar por fuso. */
export function parseBrazilianDate(raw: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null; // 31/02 e afins
  }
  return date;
}
