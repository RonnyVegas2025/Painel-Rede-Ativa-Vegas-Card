import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/constants/badge-tones";
import {
  REGISTRATION_STATUS_LABELS,
  type RegistrationStatus,
} from "@/constants/establishment-status";
import {
  OPERATIONAL_STATUS_LABELS,
  OPERATIONAL_PENDING,
  OPERATIONAL_UNAVAILABLE,
  type OperationalStatus,
} from "@/constants/operational-status";
import {
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUS_TONES,
  type TransactionStatus,
} from "@/constants/transaction-status";

/**
 * As cinco dimensões, SEPARADAS.
 *
 * O ADR 0004 vale na lista e na ficha, não só no mapa. A precedência resolve a cor
 * de **um** marcador, onde só cabe uma; numa tabela cabem as cinco, e reduzi-las a
 * uma coluna "status" recria exatamente o campo genérico que a Sprint 0 recusou —
 * com a perda que ele causa: `bloqueio_solicitado` viraria bloqueio, `suspenso`
 * viraria encerrado, e `fechado_temporariamente` sumiria dentro de "inativo".
 *
 * **Visita e ocorrência ainda não existem** (Sprints 3 e 5). Aparecem com `—`, e
 * não omitidas: omitir faria a Sprint 3 redesenhar a ficha em vez de preencher, e
 * quem lê hoje não saberia que a dimensão existe.
 */

const REGISTRATION_TONES: Record<RegistrationStatus, BadgeTone> = {
  ativo: "success",
  bloqueado: "danger",
  cancelado: "neutral",
  em_analise: "warning",
};

function tomOperacional(s: OperationalStatus): BadgeTone {
  if (OPERATIONAL_UNAVAILABLE.includes(s)) return "danger";
  if (OPERATIONAL_PENDING.includes(s)) return "warning";
  return "success";
}

export interface Dimensoes {
  cadastral: RegistrationStatus;
  transacional: TransactionStatus;
  operacional: OperationalStatus;
  visita: string | null;
  ocorrencia: string | null;
}

/** Uma linha compacta, para a tabela. */
export function DimensoesEmLinha({ d }: { d: Dimensoes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone={REGISTRATION_TONES[d.cadastral]}>
        {REGISTRATION_STATUS_LABELS[d.cadastral]}
      </Badge>
      <Badge tone={TRANSACTION_STATUS_TONES[d.transacional]}>
        {TRANSACTION_STATUS_LABELS[d.transacional]}
      </Badge>
      <Badge tone={tomOperacional(d.operacional)}>
        {OPERATIONAL_STATUS_LABELS[d.operacional]}
      </Badge>
    </div>
  );
}

/** O bloco da ficha: as cinco com rótulo próprio. */
export function DimensoesEmBloco({ d }: { d: Dimensoes }) {
  const itens: { rotulo: string; valor: string | null; tom: BadgeTone | null }[] = [
    { rotulo: "Cadastral", valor: REGISTRATION_STATUS_LABELS[d.cadastral], tom: REGISTRATION_TONES[d.cadastral] },
    { rotulo: "Transacional", valor: TRANSACTION_STATUS_LABELS[d.transacional], tom: TRANSACTION_STATUS_TONES[d.transacional] },
    { rotulo: "Operacional", valor: OPERATIONAL_STATUS_LABELS[d.operacional], tom: tomOperacional(d.operacional) },
    { rotulo: "Visita", valor: d.visita, tom: d.visita ? "info" : null },
    { rotulo: "Ocorrência", valor: d.ocorrencia, tom: d.ocorrencia ? "warning" : null },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {itens.map((i) => (
        <div key={i.rotulo}>
          <dt className="text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            {i.rotulo}
          </dt>
          <dd className="mt-1">
            {i.valor === null || i.tom === null ? (
              // `—` e não omissão: a dimensão existe, o dado é que ainda não.
              <span
                className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]"
                title="Dimensão prevista, ainda não implementada"
              >
                —
              </span>
            ) : (
              <Badge tone={i.tom}>{i.valor}</Badge>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
