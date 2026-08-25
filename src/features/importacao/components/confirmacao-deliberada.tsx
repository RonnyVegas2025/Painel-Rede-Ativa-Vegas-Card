"use client";

import { useActionState, useId, useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  avaliarConfirmacao,
  normalizarQuantidade,
} from "@/lib/business-rules/confirmacao-deliberada";
import type { ResumoDeAusentes } from "@/features/importacao/services/jobs";
import {
  aplicarImportacao,
  redeclararEscopo,
} from "@/app/(dashboard)/importacoes/actions";
import { VAZIO, type AcaoState } from "@/features/importacao/acao";

interface Props {
  importId: string;
  escopoAtual: string | null;
  ausentes: ResumoDeAusentes;
}

const nf = (n: number) => n.toLocaleString("pt-BR");

function quandoTransacionou(e: { lastTransactionAt: string | null; neverTransacted: boolean }) {
  if (e.neverTransacted) return "nunca transacionou";
  if (!e.lastTransactionAt) return "sem data de transação";
  const dias = Math.floor((Date.now() - new Date(e.lastTransactionAt).getTime()) / 86_400_000);
  if (dias <= 0) return "transacionou hoje";
  if (dias === 1) return "transacionou ontem";
  if (dias < 30) return `transacionou há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "transacionou há 1 mês" : `transacionou há ${meses} meses`;
}

/**
 * A confirmação da trava de ausentes.
 *
 * ## O caminho mais provável não é confirmar — é voltar
 *
 * A trava dispara porque o escopo foi declarado errado: alguém exportou um
 * recorte e declarou como a base inteira. Se a tela oferecesse só "confirmar com
 * atrito", o operador venceria o atrito, porque seria o único caminho visível
 * para terminar a tarefa.
 *
 * A saída aparece PRIMEIRO, é a ação primária, e leva um passo — não quatro.
 *
 * ## Os dois blocos são empilhados, não lado a lado
 *
 * Não são duas opções de uma mesma escolha. São duas decisões diferentes, e
 * enfileirá-las como botões irmãos convida a escolher pela posição.
 */
export function ConfirmacaoDeliberada({ importId, escopoAtual, ausentes }: Props) {
  const [quantidade, setQuantidade] = useState("");
  const [escopoNovo, setEscopoNovo] = useState("");
  const campoId = useId();
  const ajudaId = useId();
  const escopoId = useId();

  const [estadoAplicar, aplicar, aplicando] = useActionState<AcaoState, FormData>(
    aplicarImportacao,
    VAZIO,
  );
  const [estadoRedeclarar, redeclarar, redeclarando] = useActionState<AcaoState, FormData>(
    redeclararEscopo,
    VAZIO,
  );

  // Regra pura: a tela não decide, apenas mostra.
  const estado = avaliarConfirmacao({
    ausentes: ausentes.ausentes,
    excede: ausentes.excede,
    digitado: quantidade,
  });

  // Abaixo do limiar não há bloco nenhum: atrito em todo lugar é atrito em lugar
  // nenhum. Se a importação rotineira também exigisse digitação, a digitação
  // viraria automatismo e a trava perderia o efeito no dia em que importa.
  if (!ausentes.excede) {
    return (
      <div className="space-y-3">
        <form action={aplicar}>
          <input type="hidden" name="id" value={importId} />
          <Button type="submit" disabled={aplicando}>
            {aplicando ? "Aplicando…" : "Aplicar importação"}
          </Button>
        </form>
        <p className="text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
          {nf(ausentes.ausentes)}{" "}
          {ausentes.ausentes === 1 ? "ausente" : "ausentes"} de {nf(ausentes.noEscopo)} no escopo (
          {ausentes.percentual.toLocaleString("pt-BR")}%).
        </p>
        {estadoAplicar.error ? (
          <p role="alert" className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-danger-fg)]">
            {estadoAplicar.error}
          </p>
        ) : null}
      </div>
    );
  }

  const erroVisivel = estadoAplicar.error ?? estado.erro;

  return (
    <Card className="border-[var(--vg-warning-fg)] bg-[var(--vg-warning-bg)] p-6">
      <h2 className="flex items-start gap-2 font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
        <AlertTriangle aria-hidden className="mt-1 size-5 shrink-0 text-[var(--vg-warning-fg)]" />
        <span>
          Esta importação vai marcar {nf(ausentes.ausentes)}{" "}
          {ausentes.ausentes === 1 ? "estabelecimento" : "estabelecimentos"} como{" "}
          {ausentes.ausentes === 1 ? "ausente" : "ausentes"}
        </span>
      </h2>

      <p className="mt-3 text-[length:var(--vg-text-body)] text-[var(--vg-ink-secondary)]">
        A base tem <strong className="text-[var(--vg-ink)]">{nf(ausentes.noEscopo)}</strong>
        {escopoAtual ? <> em {escopoAtual}</> : null}. Os{" "}
        <strong className="text-[var(--vg-ink)]">{nf(ausentes.ausentes)}</strong> que não vieram no
        arquivo serão marcados como ausentes e enviados para análise administrativa.
      </p>
      <p className="mt-2 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
        Nada é excluído. Mas uma fila administrativa com {nf(ausentes.ausentes)} itens é
        indistinguível de ruído, e limpar custa mais do que reimportar.
      </p>

      {/* ---------------- A saída, que é o caminho provável ---------------- */}
      <div className="mt-6 rounded-[var(--vg-radius-md)] border border-[var(--vg-border)] bg-[var(--vg-surface)] p-5">
        <h3 className="flex items-center gap-2 font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-body)] font-semibold text-[var(--vg-ink)]">
          <MapPin aria-hidden className="size-4 shrink-0" />O arquivo é de um recorte?
        </h3>
        <p className="mt-2 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          A causa mais comum é escopo declarado errado: o arquivo é de uma região, uma
          modalidade ou um período, e foi declarado como a base inteira
          {escopoAtual ? <> de {escopoAtual}</> : null}.
        </p>

        {ausentes.exemplos.length > 0 ? (
          <div className="mt-3 text-[length:var(--vg-text-body-sm)]">
            <p className="text-[var(--vg-ink-secondary)]">Entre os que sumiriam:</p>
            <ul className="mt-1 space-y-0.5">
              {ausentes.exemplos.map((e) => (
                <li key={e.tradeName} className="text-[var(--vg-ink)]">
                  {e.tradeName}{" "}
                  <span className="text-[var(--vg-ink-secondary)]">— {quandoTransacionou(e)}</span>
                </li>
              ))}
            </ul>
            {ausentes.ausentes > ausentes.exemplos.length ? (
              <p className="mt-1 text-[var(--vg-ink-secondary)]">
                e mais {nf(ausentes.ausentes - ausentes.exemplos.length)}.
              </p>
            ) : null}
          </div>
        ) : null}

        <form action={redeclarar} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={importId} />
          <div>
            <Label htmlFor={escopoId}>Escopo correto</Label>
            <Input
              id={escopoId}
              name="escopo"
              value={escopoNovo}
              onChange={(e) => setEscopoNovo(e.target.value)}
              placeholder=""
              className="mt-1 max-w-sm"
            />
            <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
              A cidade que este arquivo realmente representa.
            </p>
          </div>
          <div>
            <Label htmlFor={`${escopoId}-obs`}>Observação (opcional)</Label>
            <Input id={`${escopoId}-obs`} name="observacao" className="mt-1 max-w-sm" />
          </div>
          <Button type="submit" disabled={redeclarando || escopoNovo.trim() === ""}>
            {redeclarando ? "Redeclarando…" : "Descartar e declarar outro escopo"}
          </Button>
          <p className="text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
            Descartar não apaga o que foi lido. A prévia fica no histórico com o motivo, e
            o arquivo é reaproveitado — não é preciso enviar de novo.
          </p>
          {estadoRedeclarar.error ? (
            <p role="alert" className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-danger-fg)]">
              {estadoRedeclarar.error}
            </p>
          ) : null}
        </form>
      </div>

      <hr className="my-6 border-[var(--vg-border)]" />

      {/* ---------------- A confirmação, que é o caso raro ---------------- */}
      <div>
        <h3 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-body)] font-semibold text-[var(--vg-ink)]">
          A rede encolheu mesmo?
        </h3>
        <p className="mt-2 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          Se {ausentes.ausentes === 1 ? "ele realmente deixou" : "eles realmente deixaram"} de
          operar, confirme digitando a quantidade.
        </p>

        <form action={aplicar} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={importId} />
          {/* O número que ESTA tela mostrou. O servidor reconta e compara: se a
              base mudou nesse meio-tempo, o operador aprovou um número que não
              existe mais. */}
          <input type="hidden" name="mostrado" value={String(ausentes.ausentes)} />

          <div>
            <Label htmlFor={campoId}>Quantidade de estabelecimentos a marcar como ausentes</Label>
            <Input
              id={campoId}
              name="quantidade"
              inputMode="numeric"
              autoComplete="off"
              aria-describedby={ajudaId}
              aria-invalid={erroVisivel ? true : undefined}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="mt-1 max-w-[12rem]"
            />
            {/* Erro no MESMO lugar da ajuda contextual (UI Standard §12). */}
            <p
              id={ajudaId}
              role={erroVisivel ? "alert" : undefined}
              className={`mt-1 text-[length:var(--vg-text-caption)] ${
                erroVisivel ? "text-[var(--vg-danger-fg)]" : "text-[var(--vg-ink-secondary)]"
              }`}
            >
              {erroVisivel ?? `Digite ${nf(ausentes.ausentes)} para habilitar a aplicação.`}
            </p>
          </div>

          {/* `aria-disabled`, não `disabled`: o botão continua focável e o motivo
              continua legível para quem navega por teclado. Botão cinza que some
              do foco não explica nada. */}
          <Button
            type="submit"
            variant="danger"
            aria-disabled={!estado.podeAplicar || aplicando}
            onClick={(e) => {
              if (!estado.podeAplicar || aplicando) e.preventDefault();
            }}
          >
            {aplicando ? "Aplicando…" : "Aplicar importação"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

export { normalizarQuantidade };
