"use client";

import { useActionState, useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizarQuantidade } from "@/lib/business-rules/confirmacao-deliberada";
import type { Ausente } from "@/features/importacao/services/jobs";
import { resolverAusencia } from "@/app/(dashboard)/importacoes/actions";
import { VAZIO, type AcaoState } from "@/features/importacao/acao";

type Decisao = "voltou_a_operar" | "escopo_incorreto" | "nao_opera_mais";

const DECISOES: readonly { valor: Decisao; rotulo: string; explica: string }[] = [
  {
    valor: "escopo_incorreto",
    rotulo: "O arquivo era um recorte",
    explica:
      "Desmarca e devolve ao estado anterior. É o caso mais provável quando há muitos de uma vez — ninguém perde centenas de comércios num mês.",
  },
  {
    valor: "voltou_a_operar",
    rotulo: "Continua operando",
    explica: "Desmarca. Verificado por telefone, ou vai reaparecer na próxima importação.",
  },
  {
    valor: "nao_opera_mais",
    rotulo: "Não opera mais",
    explica:
      "Marca como fechado temporariamente. NÃO grava encerramento: ausência numa planilha não é confirmação em campo, e só a visita confirma o definitivo.",
  },
];

const nf = (n: number) => n.toLocaleString("pt-BR");

function quando(a: Ausente) {
  if (a.neverTransacted) return "nunca transacionou";
  if (!a.lastTransactionAt) return "sem data";
  const dias = Math.floor((Date.now() - new Date(a.lastTransactionAt).getTime()) / 86_400_000);
  if (dias <= 1) return dias <= 0 ? "transacionou hoje" : "transacionou ontem";
  if (dias < 30) return `transacionou há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "transacionou há 1 mês" : `transacionou há ${meses} meses`;
}

/**
 * A fila que o ADR 0011 previu e não tinha onde acontecer.
 *
 * Ordenada por transação mais recente: um comércio que transacionou semana
 * passada e sumiu do arquivo é o sinal mais forte de escopo errado. Ordenar por
 * "ausente há mais tempo" poria no topo justamente os casos já mortos.
 */
export function FilaDeAusentes({ ausentes }: { ausentes: readonly Ausente[] }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [decisao, setDecisao] = useState<Decisao>("escopo_incorreto");
  const [quantidade, setQuantidade] = useState("");
  const [estado, resolver, resolvendo] = useActionState<AcaoState, FormData>(
    resolverAusencia,
    VAZIO,
  );
  const campoId = useId();
  const motivoId = useId();

  const n = selecionados.size;
  const exigeQuantidade = decisao === "nao_opera_mais" && n > 1;
  const quantidadeOk = !exigeQuantidade || normalizarQuantidade(quantidade) === n;

  const alternar = (id: string) =>
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  if (ausentes.length === 0) {
    return (
      <Card>
        <p className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          Nenhum estabelecimento aguardando análise de ausência.
        </p>
      </Card>
    );
  }

  const escolhida = DECISOES.find((d) => d.valor === decisao)!;

  return (
    <form action={resolver}>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[length:var(--vg-text-body)] text-[var(--vg-ink)]">
            {nf(ausentes.length)}{" "}
            {ausentes.length === 1 ? "aguardando análise" : "aguardando análise"}
            {n > 0 ? (
              <span className="text-[var(--vg-ink-secondary)]"> · {nf(n)} selecionados</span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="text"
              onClick={() => setSelecionados(new Set(ausentes.map((a) => a.id)))}
            >
              Selecionar todos
            </Button>
            <Button type="button" variant="text" onClick={() => setSelecionados(new Set())}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto rounded-[var(--vg-radius-md)] border border-[var(--vg-border)]">
          <table className="w-full text-left text-[length:var(--vg-text-body-sm)]">
            <thead className="sticky top-0 bg-[var(--vg-surface-muted)] text-[var(--vg-ink-secondary)]">
              <tr>
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Selecionar</span></th>
                <th scope="col" className="px-3 py-2 font-medium">Estabelecimento</th>
                <th scope="col" className="px-3 py-2 font-medium">Última transação</th>
                <th scope="col" className="px-3 py-2 font-medium">Ausente desde</th>
              </tr>
            </thead>
            <tbody>
              {ausentes.map((a) => (
                <tr key={a.id} className="border-t border-[var(--vg-border)]">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      name="id"
                      value={a.id}
                      checked={selecionados.has(a.id)}
                      onChange={() => alternar(a.id)}
                      aria-label={`Selecionar ${a.tradeName}`}
                      className="size-4"
                    />
                  </td>
                  <td className="px-3 py-2 text-[var(--vg-ink)]">
                    {a.tradeName}
                    <span className="block text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                      {a.externalContract ?? "sem contrato"}
                      {a.cidade ? ` · ${a.cidade}` : ""}
                      {a.arquivo ? ` · ${a.arquivo}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">{quando(a)}</td>
                  <td className="px-3 py-2 text-[var(--vg-ink-secondary)]">
                    {new Date(a.absentSince).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <fieldset className="mt-6">
          <legend className="text-[length:var(--vg-text-body)] text-[var(--vg-ink)]">Decisão</legend>
          <div className="mt-2 space-y-2">
            {DECISOES.map((d) => (
              <label key={d.valor} className="flex gap-2">
                <input
                  type="radio"
                  name="resolucao"
                  value={d.valor}
                  checked={decisao === d.valor}
                  onChange={() => setDecisao(d.valor)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>
                  <span className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink)]">
                    {d.rotulo}
                  </span>
                  <span className="block text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                    {d.explica}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <Label htmlFor={motivoId}>Motivo</Label>
          <Input id={motivoId} name="motivo" required className="mt-1" />
          <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            Fica no histórico da decisão, junto de quem decidiu e quando.
          </p>
        </div>

        {/* A assimetria: desmarcar em lote não tem atrito; mudar a dimensão
            operacional de vários de uma vez tem. Por item, nenhum dos dois tem. */}
        {exigeQuantidade ? (
          <div className="mt-4 rounded-[var(--vg-radius-md)] border border-[var(--vg-warning-fg)] bg-[var(--vg-warning-bg)] p-4">
            <p className="flex items-start gap-2 text-[length:var(--vg-text-body-sm)] text-[var(--vg-warning-fg)]">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {nf(n)} estabelecimentos sairão das listas de aptos. Se são muitos de uma
                vez, o escopo do arquivo provavelmente estava errado.
              </span>
            </p>
            <div className="mt-3">
              <Label htmlFor={campoId}>Quantidade para confirmar</Label>
              <Input
                id={campoId}
                name="quantidade"
                inputMode="numeric"
                autoComplete="off"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="mt-1 max-w-[12rem]"
              />
              <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                Digite {nf(n)} para habilitar.
              </p>
            </div>
          </div>
        ) : null}

        <Button
          type="submit"
          variant={decisao === "nao_opera_mais" ? "danger" : "primary"}
          className="mt-4"
          aria-disabled={n === 0 || !quantidadeOk || resolvendo}
          onClick={(e) => {
            if (n === 0 || !quantidadeOk || resolvendo) e.preventDefault();
          }}
        >
          {resolvendo ? "Registrando…" : `Registrar decisão${n > 0 ? ` (${nf(n)})` : ""}`}
        </Button>

        {estado.error ? (
          <p role="alert" className="mt-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-danger-fg)]">
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p role="status" className="mt-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
            Decisão registrada. {escolhida.rotulo}.
          </p>
        ) : null}
      </Card>
    </form>
  );
}
