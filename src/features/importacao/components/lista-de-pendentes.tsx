"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { JobPendente } from "@/features/importacao/services/jobs";
import { descartarImportacao } from "@/app/(dashboard)/importacoes/actions";
import { VAZIO, type AcaoState } from "@/features/importacao/acao";

const dt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ItemPendente({ job }: { job: JobPendente }) {
  const [estado, descartar, descartando] = useActionState<AcaoState, FormData>(
    descartarImportacao,
    VAZIO,
  );

  const interrompida = job.status === "processando";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--vg-font-sans)] text-[length:var(--vg-text-body)] text-[var(--vg-ink)]">
            {job.fileName}
          </p>
          <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            {dt(job.startedAt)}
            {job.scopeCity ? <> · escopo: {job.scopeCity}</> : null}
            {job.totalRows > 0 ? <> · {job.totalRows.toLocaleString("pt-BR")} linhas</> : null}
          </p>
        </div>
        {interrompida ? (
          <Badge tone="warning">Interrompida durante a leitura do arquivo</Badge>
        ) : (
          <Badge tone="info">Aguardando revisão</Badge>
        )}
      </div>

      {/* A janela dos dois tempos, legível.
          Entre criar a derivada e descartar a original os dois ficam vivos. Se o
          Node cair no meio, o transitório vira permanente: duas prévias
          aplicáveis e o operador sem saber qual. Sem estes rótulos o estado é
          visível e ilegível, que é quase o mesmo que invisível. */}
      {job.derivadoDeId ? (
        <p className="mt-3 flex items-center gap-1.5 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          <GitBranch aria-hidden className="size-4 shrink-0" />
          Redeclarada a partir de{" "}
          <Link
            href={`${ROUTES.IMPORTACOES}/${job.derivadoDeId}`}
            className="underline underline-offset-2"
          >
            outra prévia
          </Link>
          .
        </p>
      ) : null}

      {job.substituidoPorId ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-[var(--vg-radius-md)] border border-[var(--vg-warning-fg)] bg-[var(--vg-warning-bg)] p-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-warning-fg)]">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          <span>
            Substituída por{" "}
            <Link
              href={`${ROUTES.IMPORTACOES}/${job.substituidoPorId}`}
              className="underline underline-offset-2"
            >
              esta prévia
            </Link>
            . Esta aqui deveria ter sido descartada — descarte para não aplicar a errada.
          </span>
        </p>
      ) : null}

      {interrompida ? (
        <p className="mt-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          A leitura do arquivo não terminou, então esta importação não pode ser aplicada:
          um lote parcial aplicaria metade da base sem ninguém perceber. Descarte e envie de
          novo.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Job em `processando` NÃO tem botão de aplicar — ausente, não
            desabilitado. Botão desabilitado convida a procurar como habilitar. */}
        {!interrompida ? (
          <Link
            href={`${ROUTES.IMPORTACOES}/${job.id}`}
            className="inline-flex h-11 items-center rounded-[var(--vg-radius-md)] border border-[var(--vg-border-field)] bg-[var(--vg-surface)] px-4 text-[length:var(--vg-text-body)] text-[var(--vg-brand-500)] hover:bg-[var(--vg-brand-50)]"
          >
            Revisar prévia
            <ArrowRight aria-hidden className="ml-2 size-4" />
          </Link>
        ) : null}

        <form action={descartar}>
          <input type="hidden" name="id" value={job.id} />
          <input
            type="hidden"
            name="motivo"
            value={interrompida ? "leitura do arquivo interrompida" : "descartada na lista de pendentes"}
          />
          <Button type="submit" variant="text" disabled={descartando}>
            {descartando ? "Descartando…" : "Descartar"}
          </Button>
        </form>
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="mt-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-danger-fg)]"
        >
          {estado.error}
        </p>
      ) : null}
    </Card>
  );
}
