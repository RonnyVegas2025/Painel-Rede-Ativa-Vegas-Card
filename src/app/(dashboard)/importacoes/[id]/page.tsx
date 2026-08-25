import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import type { ImportRowStatus } from "@/lib/business-rules/classify-import-row";
import {
  LINHAS_POR_PAGINA,
  lerPrevia,
  listarLinhas,
} from "@/features/importacao/services/jobs";
import { ConfirmacaoDeliberada } from "@/features/importacao/components/confirmacao-deliberada";
import { TabelaDeLinhas } from "@/features/importacao/components/tabela-de-linhas";

export const metadata: Metadata = { title: "Prévia da importação · Rede Vegas Ativa" };

const ESTADOS: readonly ImportRowStatus[] = [
  "novo", "atualizado", "inalterado", "conflito", "erro",
];

const nf = (n: number) => n.toLocaleString("pt-BR");

/**
 * A prévia. A rota é sempre `/importacoes/[id]`, nunca "a prévia atual": com a
 * redeclaração em dois tempos podem existir dois jobs vivos, e "a atual" não
 * existe.
 */
export default async function PreviaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string; pagina?: string }>;
}) {
  await requirePermission("importacao.executar");

  const { id } = await params;
  const { estado: estadoBruto, pagina: paginaBruta } = await searchParams;

  const previa = await lerPrevia(id);
  if (!previa) notFound();

  const filtro = ESTADOS.includes(estadoBruto as ImportRowStatus)
    ? (estadoBruto as ImportRowStatus)
    : null;
  const pagina = Math.max(1, Number(paginaBruta ?? "1") || 1);
  const { linhas, total } = await listarLinhas(id, filtro, pagina);

  const foraDoEscopo = previa.cidades.filter(
    (c) => previa.scopeCity !== null && c.cidade !== previa.scopeCity,
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: "Importações", href: ROUTES.IMPORTACOES }]}
        title={previa.fileName}
        description={
          previa.scopeCity
            ? `Escopo declarado: ${previa.scopeCity} · ${nf(previa.totalRows)} linhas`
            : `${nf(previa.totalRows)} linhas`
        }
      />

      {previa.derivadoDeId ? (
        <p className="mb-4 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
          Redeclarada a partir de{" "}
          <Link
            href={`${ROUTES.IMPORTACOES}/${previa.derivadoDeId}`}
            className="underline underline-offset-2"
          >
            outra prévia
          </Link>
          .
        </p>
      ) : null}

      {/* Os agregados primeiro, sempre visíveis. A decisão é sobre eles; o
          detalhe abaixo serve para conferir uma suspeita. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Numero rotulo="Novos" valor={previa.contagens.novo} />
        <Numero rotulo="Atualizados" valor={previa.contagens.atualizado} />
        <Numero rotulo="Inalterados" valor={previa.contagens.inalterado} />
        <Numero rotulo="Conflitos" valor={previa.contagens.conflito} />
        <Numero rotulo="Erros" valor={previa.contagens.erro} />
        <Numero rotulo="Ausentes" valor={previa.contagens.ausente} />
      </div>

      {/* Escopo declarado × conteúdo do arquivo, com as grafias CRUAS.
          Divergência avisa, não bloqueia — o operador decide. */}
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
          Cidades no arquivo
        </h2>
        <ul className="mt-3 space-y-1 text-[length:var(--vg-text-body-sm)]">
          {previa.cidades.map((c) => (
            <li key={c.cidade ?? "—"} className="text-[var(--vg-ink)]">
              {c.cidade ?? "sem cidade"}{" "}
              <span className="text-[var(--vg-ink-secondary)]">({nf(c.linhas)})</span>
              {previa.scopeCity !== null && c.cidade !== previa.scopeCity ? (
                <span className="ml-2 text-[var(--vg-warning-fg)]">fora do escopo declarado</span>
              ) : null}
            </li>
          ))}
        </ul>
        {foraDoEscopo.length > 0 ? (
          <p className="mt-3 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
            {foraDoEscopo.length === 1 ? "Uma grafia diverge" : `${foraDoEscopo.length} grafias divergem`}{" "}
            do escopo declarado. Ou o escopo está errado, ou o arquivo está — as grafias são
            mostradas como vieram, sem normalizar, porque é isso que você precisa julgar.
          </p>
        ) : null}
      </Card>

      {previa.duplicatedCaptureMethods > 0 || previa.addressesWithoutNumber > 0 ? (
        <Card className="mb-6">
          <h2 className="font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h3)] text-[var(--vg-ink)]">
            Qualidade da origem
          </h2>
          <ul className="mt-3 space-y-1 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
            {previa.duplicatedCaptureMethods > 0 ? (
              <li>
                {nf(previa.duplicatedCaptureMethods)}{" "}
                {previa.duplicatedCaptureMethods === 1 ? "linha repete" : "linhas repetem"} o
                mesmo meio de captura na própria célula. Deduplicado — não bloqueia nada, mas
                silenciar faria o dado errado voltar em toda importação.
              </li>
            ) : null}
            {previa.addressesWithoutNumber > 0 ? (
              <li>
                {nf(previa.addressesWithoutNumber)}{" "}
                {previa.addressesWithoutNumber === 1 ? "endereço" : "endereços"} sem número.
              </li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      <div className="mb-8">
        {previa.status === "previa" ? (
          <ConfirmacaoDeliberada
            importId={previa.id}
            escopoAtual={previa.scopeCity}
            ausentes={previa.ausentes}
          />
        ) : (
          <Card>
            <p className="text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
              Esta importação está em <strong>{previa.status}</strong> e não pode ser
              aplicada.
            </p>
          </Card>
        )}
      </div>

      <TabelaDeLinhas
        importId={previa.id}
        linhas={linhas}
        total={total}
        pagina={pagina}
        porPagina={LINHAS_POR_PAGINA}
        filtro={filtro}
        contagens={previa.contagens}
      />
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <Card className="p-4">
      <p className="text-[length:var(--vg-text-caption)] text-[var(--vg-ink-secondary)]">
        {rotulo}
      </p>
      <p className="mt-1 font-[family-name:var(--vg-font-display)] text-[length:var(--vg-text-h2)] text-[var(--vg-ink)] [font-variant-numeric:tabular-nums]">
        {nf(valor)}
      </p>
    </Card>
  );
}
