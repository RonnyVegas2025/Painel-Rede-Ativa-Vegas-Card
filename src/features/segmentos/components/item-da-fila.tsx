"use client";

import { useActionState, useId, useState } from "react";
import { AlertTriangle, Check, Link2, PenLine, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { SegmentRuleType } from "@/lib/business-rules/check-product-eligibility";
import type { RuleMigrationDecision } from "@/lib/business-rules/resolve-rule-migration";
import type {
  CanonicoDisponivel,
  ItemDaFila,
  Modalidade,
} from "@/features/segmentos/services/fila";
import {
  confirmarComoEsta,
  criarComoProprio,
  desativarSegmento,
  mapearParaCanonico,
  type AcaoState,
} from "@/app/(dashboard)/segmentos/actions";

type Acao = "confirmar" | "criar" | "mapear" | "desativar" | null;

const ESTADO_INICIAL: AcaoState = { error: null, ok: false };

const CATEGORIAS = [
  ["alimentacao", "Alimentação"],
  ["refeicao", "Refeição"],
  ["farmacia", "Farmácia"],
  ["combustivel", "Combustível"],
  ["servicos", "Serviços"],
  ["outros", "Outros"],
] as const;

interface Props {
  item: ItemDaFila;
  modalidades: readonly Modalidade[];
  regrasAtuais: Record<string, SegmentRuleType>;
  canonicos: readonly CanonicoDisponivel[];
  bloqueadores: readonly RuleMigrationDecision[];
}

/**
 * Um item da fila, com as quatro ações.
 *
 * `confirmar` e `criar` também definem as modalidades. Sem isso o ciclo não
 * fecha: resolver a fila responde "que segmento é este", e nada fica elegível
 * até alguém responder "quais modalidades o aceitam" — que hoje só teria como
 * ser respondido por SQL direto.
 *
 * `mapear` não precisa disso: o alias herda a elegibilidade do canônico, que é o
 * ponto do ADR 0003.
 */
export function ItemDaFilaCard({
  item,
  modalidades,
  regrasAtuais,
  canonicos,
  bloqueadores,
}: Props) {
  const [acao, setAcao] = useState<Acao>(null);
  const baseId = useId();

  const [estadoConfirmar, aplicarConfirmar, confirmando] = useActionState(
    confirmarComoEsta,
    ESTADO_INICIAL,
  );
  const [estadoCriar, aplicarCriar, criando] = useActionState(criarComoProprio, ESTADO_INICIAL);
  const [estadoMapear, aplicarMapear, mapeando] = useActionState(
    mapearParaCanonico,
    ESTADO_INICIAL,
  );
  const [estadoDesativar, aplicarDesativar, desativando] = useActionState(
    desativarSegmento,
    ESTADO_INICIAL,
  );

  const erro =
    estadoConfirmar.error ?? estadoCriar.error ?? estadoMapear.error ?? estadoDesativar.error;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* O valor cru da planilha, com os erros da origem. Nunca é editado:
              é a chave de reconciliação da importação. */}
          <p className="font-[family-name:var(--vg-font-sans)] text-[length:var(--vg-text-body)] text-[var(--vg-ink)] [font-variant-numeric:tabular-nums]">
            {item.sourceName}
          </p>
          {item.cnaeHint && (
            <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
              CNAE {item.cnaeHint}
            </p>
          )}
        </div>

        {/* O número que transforma a lista em fila de prioridade. */}
        <Badge tone={item.establishmentsHidden > 0 ? "warning" : "neutral"}>
          {item.establishmentsHidden === 0
            ? "nenhum estabelecimento"
            : `${item.establishmentsHidden.toLocaleString("pt-BR")} ${
                item.establishmentsHidden === 1
                  ? "estabelecimento escondido"
                  : "estabelecimentos escondidos"
              }`}
        </Badge>
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--vg-radius-md)] border border-[var(--vg-danger-fg)] bg-[var(--vg-danger-bg)] p-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-danger-fg)]"
        >
          {erro}
        </p>
      )}

      {acao === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAcao("confirmar")}>
            <Check aria-hidden className="mr-2 size-4" />
            Confirmar como está
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAcao("criar")}>
            <PenLine aria-hidden className="mr-2 size-4" />
            Criar como próprio
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAcao("mapear")}>
            <Link2 aria-hidden className="mr-2 size-4" />
            Mapear para existente
          </Button>
          <Button size="sm" variant="text" onClick={() => setAcao("desativar")}>
            <Power aria-hidden className="mr-2 size-4" />
            Desativar
          </Button>
        </div>
      )}

      {acao === "confirmar" && (
        <form action={aplicarConfirmar} className="mt-4 space-y-4">
          <input type="hidden" name="segmentId" value={item.id} />
          <Modalidades
            baseId={`${baseId}-conf`}
            modalidades={modalidades}
            regrasAtuais={regrasAtuais}
          />
          <Acoes onCancelar={() => setAcao(null)} carregando={confirmando} rotulo="Confirmar" />
        </form>
      )}

      {acao === "criar" && (
        <form action={aplicarCriar} className="mt-4 space-y-4">
          <input type="hidden" name="segmentId" value={item.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${baseId}-nome`}>Nome de exibição</Label>
              <Input
                id={`${baseId}-nome`}
                name="normalizedName"
                defaultValue={item.normalizedName}
                required
              />
              <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
                O valor da planilha permanece intocado — é o que faz a próxima
                importação reconhecer este segmento.
              </p>
            </div>
            <div>
              <Label htmlFor={`${baseId}-cat`}>Categoria</Label>
              <select
                id={`${baseId}-cat`}
                name="category"
                defaultValue={item.category}
                className="h-11 w-full rounded-[var(--vg-radius-md)] border border-[var(--vg-border-field)] bg-[var(--vg-surface)] px-3 text-[length:var(--vg-text-body)] text-[var(--vg-ink)]"
              >
                {CATEGORIAS.map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Modalidades
            baseId={`${baseId}-criar`}
            modalidades={modalidades}
            regrasAtuais={regrasAtuais}
          />
          <Acoes onCancelar={() => setAcao(null)} carregando={criando} rotulo="Criar segmento" />
        </form>
      )}

      {acao === "mapear" && (
        <form action={aplicarMapear} className="mt-4 space-y-4">
          <input type="hidden" name="segmentId" value={item.id} />
          <div>
            <Label htmlFor={`${baseId}-canon`}>Segmento canônico</Label>
            <select
              id={`${baseId}-canon`}
              name="canonicalId"
              required
              defaultValue=""
              className="h-11 w-full rounded-[var(--vg-radius-md)] border border-[var(--vg-border-field)] bg-[var(--vg-surface)] px-3 text-[length:var(--vg-text-body)] text-[var(--vg-ink)]"
            >
              <option value="" disabled>
                Escolha para qual segmento este passa a apontar
              </option>
              {canonicos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.normalizedName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
              O alias herda a elegibilidade do canônico e mantém o próprio valor de
              origem, então a importação seguinte continua reconhecendo os dois.
            </p>
          </div>

          {bloqueadores.length > 0 && (
            <Bloqueadores decisoes={bloqueadores} baseId={baseId} />
          )}

          <Acoes onCancelar={() => setAcao(null)} carregando={mapeando} rotulo="Mapear" />
        </form>
      )}

      {acao === "desativar" && (
        <form action={aplicarDesativar} className="mt-4 space-y-4">
          <input type="hidden" name="segmentId" value={item.id} />
          <div
            role="alert"
            className="rounded-[var(--vg-radius-md)] border border-[var(--vg-warning-fg)] bg-[var(--vg-warning-bg)] p-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-warning-fg)]"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                Segmento inativo sai de <strong>todas</strong> as modalidades, não só
                da que motivou a revisão.{" "}
                {item.establishmentsHidden > 0 && (
                  <>
                    <strong>
                      {item.establishmentsHidden.toLocaleString("pt-BR")}
                    </strong>{" "}
                    {item.establishmentsHidden === 1
                      ? "estabelecimento ficará"
                      : "estabelecimentos ficarão"}{" "}
                    sem segmento elegível.
                  </>
                )}
              </span>
            </p>
            <label className="mt-3 flex min-h-11 items-center gap-2">
              <input type="checkbox" name="confirmado" value="1" className="size-4" required />
              <span>Entendi e quero desativar</span>
            </label>
          </div>
          <Acoes onCancelar={() => setAcao(null)} carregando={desativando} rotulo="Desativar" />
        </form>
      )}
    </Card>
  );
}

function Acoes({
  onCancelar,
  carregando,
  rotulo,
}: {
  onCancelar: () => void;
  carregando: boolean;
  rotulo: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" loading={carregando}>
        {rotulo}
      </Button>
      <Button type="button" size="sm" variant="text" onClick={onCancelar}>
        Cancelar
      </Button>
    </div>
  );
}

/**
 * "Quais modalidades aceitam este segmento" — pergunta diferente de "que segmento
 * é este", e a que governa `product_segments`.
 *
 * Modalidade em modo `all` não usa vínculo, então não aparece: oferecer a escolha
 * ali seria pedir uma decisão que o sistema ignora.
 */
function Modalidades({
  baseId,
  modalidades,
  regrasAtuais,
}: {
  baseId: string;
  modalidades: readonly Modalidade[];
  regrasAtuais: Record<string, SegmentRuleType>;
}) {
  const comVinculo = modalidades.filter((m) => m.eligibilityMode !== "all");
  if (comVinculo.length === 0) return null;

  return (
    <fieldset>
      <legend className="mb-2 text-[length:var(--vg-text-body-sm)] font-medium text-[var(--vg-ink)]">
        Modalidades que aceitam este segmento
      </legend>
      <div className="space-y-2">
        {comVinculo.map((m) => {
          const atual = regrasAtuais[m.id] ?? "";
          const nome = `${baseId}-${m.id}`;
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-40 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink)]">
                {m.name}
              </span>
              {(
                [
                  ["", "não se aplica"],
                  ["allow", "aceita"],
                  ["deny", "recusa"],
                ] as const
              ).map(([valor, rotulo]) => (
                <label key={rotulo} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name={nome}
                    defaultChecked={atual === valor}
                    className="size-4"
                    onChange={(e) => {
                      const form = e.currentTarget.form;
                      if (!form) return;
                      // Um par de campos ocultos por modalidade carrega a escolha
                      // no formato que a RPC espera: duas listas, allow e deny.
                      const oculto = form.querySelector<HTMLInputElement>(
                        `input[data-modalidade="${m.id}"]`,
                      );
                      if (oculto) {
                        oculto.name = valor === "" ? "ignorado" : valor;
                        oculto.value = m.id;
                      }
                    }}
                  />
                  <span className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
                    {rotulo}
                  </span>
                </label>
              ))}
              <input
                type="hidden"
                data-modalidade={m.id}
                name={atual === "" ? "ignorado" : atual}
                value={m.id}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
        Sem ao menos uma modalidade que aceite, o segmento continua fora das listas
        restritas — é a falha fechada funcionando, não um defeito.
      </p>
    </fieldset>
  );
}

/**
 * As regras que impedem mapear, com o que acontece com cada uma.
 *
 * Não basta dizer que existem: a decisão depende de saber se migrar colide, e se
 * a colisão é a mesma intenção (nada a fazer) ou a intenção contrária (escolher).
 */
function Bloqueadores({
  decisoes,
  baseId,
}: {
  decisoes: readonly RuleMigrationDecision[];
  baseId: string;
}) {
  const temConflito = decisoes.some((d) => d.outcome === "conflito");

  return (
    <fieldset className="rounded-[var(--vg-radius-md)] border border-[var(--vg-border-field)] p-3">
      <legend className="px-1 text-[length:var(--vg-text-body-sm)] font-medium text-[var(--vg-ink)]">
        Regras de elegibilidade neste segmento
      </legend>
      <p className="mb-3 text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
        Com o alias, quem governa passa a ser o canônico. Estas regras precisam ser
        migradas ou descartadas — se ficassem, continuariam visíveis e sem efeito.
      </p>

      <div className="space-y-3">
        {decisoes.map((d) => (
          <div key={d.cardProductId}>
            <p className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink)]">
              {d.cardProductName} · {d.aliasRule === "allow" ? "aceita" : "recusa"}
              {d.outcome === "ja_existe" && (
                <span className="text-[var(--vg-ink-secondary)]">
                  {" "}
                  — o canônico já tem a mesma regra; descartar não muda nada
                </span>
              )}
              {d.outcome === "conflito" && (
                <span className="text-[var(--vg-danger-fg)]">
                  {" "}
                  — o canônico tem a regra contrária (
                  {d.canonicalRule === "allow" ? "aceita" : "recusa"}). Escolha qual
                  prevalece.
                </span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={`${baseId}-destino-${d.cardProductId}`}
                  className="size-4"
                  onChange={(e) => {
                    const oculto = e.currentTarget.form?.querySelector<HTMLInputElement>(
                      `input[data-bloqueador="${d.cardProductId}"]`,
                    );
                    if (oculto) oculto.name = "migrate";
                  }}
                />
                <span className="text-[length:var(--vg-text-body-sm)]">
                  {d.outcome === "conflito"
                    ? "Migrar — a regra deste segmento prevalece"
                    : "Migrar para o canônico"}
                </span>
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={`${baseId}-destino-${d.cardProductId}`}
                  className="size-4"
                  defaultChecked={d.outcome === "ja_existe"}
                  onChange={(e) => {
                    const oculto = e.currentTarget.form?.querySelector<HTMLInputElement>(
                      `input[data-bloqueador="${d.cardProductId}"]`,
                    );
                    if (oculto) oculto.name = "discard";
                  }}
                />
                <span className="text-[length:var(--vg-text-body-sm)]">
                  {d.outcome === "conflito"
                    ? "Descartar — a regra do canônico prevalece"
                    : "Descartar"}
                </span>
              </label>
            </div>
            <input
              type="hidden"
              data-bloqueador={d.cardProductId}
              name={d.outcome === "ja_existe" ? "discard" : "indefinido"}
              value={d.cardProductId}
            />
          </div>
        ))}
      </div>

      {temConflito && (
        <label className="mt-3 flex min-h-11 items-center gap-2">
          <input type="checkbox" name="conflitoResolvido" value="1" className="size-4" />
          <span className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink)]">
            Confirmo a escolha nos conflitos acima
          </span>
        </label>
      )}
    </fieldset>
  );
}
