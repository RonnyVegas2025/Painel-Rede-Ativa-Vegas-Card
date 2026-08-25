"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarImportacao } from "@/app/(dashboard)/importacoes/actions";
import { VAZIO, type AcaoState } from "@/features/importacao/acao";

export function FormularioDeImportacao() {
  const [estado, enviar, enviando] = useActionState<AcaoState, FormData>(criarImportacao, VAZIO);
  const arquivoId = useId();
  const escopoId = useId();

  return (
    <Card>
      <form action={enviar} className="space-y-5">
        <div>
          <Label htmlFor={arquivoId}>Planilha</Label>
          <Input
            id={arquivoId}
            name="arquivo"
            type="file"
            accept=".xlsx"
            required
            className="mt-1"
          />
          <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            Arquivo `.xlsx`, até 20 MB. O contrato é o CABEÇALHO das 20 colunas, não o nome
            do arquivo.
          </p>
        </div>

        <div>
          <Label htmlFor={escopoId}>Escopo desta importação</Label>
          <Input id={escopoId} name="escopo" required className="mt-1" />
          {/* O operador declara; o arquivo não decide. Inferir escopo do conteúdo
              é exatamente o erro que a trava de ausentes existe para pegar. */}
          <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            A cidade que este arquivo representa. Só os estabelecimentos deste escopo podem
            ser marcados como ausentes — sem ele, importar o recorte de uma cidade faria o
            resto da base aparecer como sumido.
          </p>
        </div>

        <Button type="submit" disabled={enviando}>
          {enviando ? "Lendo a planilha…" : "Gerar prévia"}
        </Button>

        {estado.error ? (
          <p
            role="alert"
            className="rounded-[var(--vg-radius-md)] border border-[var(--vg-danger-fg)] bg-[var(--vg-danger-bg)] p-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-danger-fg)]"
          >
            {estado.error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
