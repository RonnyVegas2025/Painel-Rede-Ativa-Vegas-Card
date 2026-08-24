import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/require-role";
import { ItemDaFilaCard } from "@/features/segmentos/components/item-da-fila";
import {
  listarBloqueadores,
  listarCanonicosDisponiveis,
  listarFila,
  listarModalidades,
  lerRegrasDaFila,
} from "@/features/segmentos/services/fila";

export const metadata: Metadata = { title: "Segmentos · Rede Vegas Ativa" };

/**
 * Fila de normalização de segmentos.
 *
 * Entregável, não extra (ADR 0003). A falha fechada faz segmento não mapeado
 * sumir das modalidades restritas: sem esta tela, comércio legítimo fica
 * invisível e ninguém sabe por quê.
 *
 * Na base real isso não é hipótese — os 15 valores de `Subgrupo` da planilha têm
 * interseção zero com qualquer catálogo prévio, então logo após a primeira
 * importação a fila cobre 100% da base e nada é elegível a Farmácia, Alimentação,
 * Refeição ou Combustível até alguém resolvê-la.
 */
export default async function SegmentosPage() {
  await requirePermission("segmentos.editar");

  const [fila, modalidades] = await Promise.all([listarFila(), listarModalidades()]);
  const regrasPorSegmento = await lerRegrasDaFila(fila.map((i) => i.id));

  // Canônicos e bloqueadores por item. Com a fila resolvida isto some; com ela
  // cheia são poucas dezenas de itens, e a alternativa — carregar sob demanda —
  // acrescentaria estado de carregamento a uma tela que precisa ser decidível de
  // uma olhada.
  const itens = await Promise.all(
    fila.map(async (item) => ({
      item,
      regrasAtuais: regrasPorSegmento.get(item.id) ?? {},
      canonicos: await listarCanonicosDisponiveis(item.id),
      bloqueadores: await listarBloqueadores(item.id, null),
    })),
  );

  const escondidos = fila.reduce((soma, i) => soma + i.establishmentsHidden, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Segmentos"
        description={
          fila.length === 0
            ? "Nenhuma pendência de normalização."
            : `${fila.length} ${fila.length === 1 ? "pendência" : "pendências"} · ` +
              `${escondidos.toLocaleString("pt-BR")} ${
                escondidos === 1 ? "estabelecimento escondido" : "estabelecimentos escondidos"
              } das modalidades restritas`
        }
      />

      {fila.length === 0 ? (
        <EmptyState
          title="Fila vazia"
          description={
            "Todo segmento conhecido já foi revisado. Segmentos novos entram aqui " +
            "automaticamente na próxima importação — o valor cru da planilha é a " +
            "chave, então nada é recriado por engano."
          }
        />
      ) : (
        <>
          <p className="mb-4 text-[length:var(--vg-text-body-sm)] text-[var(--vg-ink-secondary)]">
            Ordenado por quantos estabelecimentos cada pendência esconde. Enquanto um
            segmento não é resolvido, os estabelecimentos ligados a ele não aparecem
            em Farmácia, Alimentação, Refeição nem Combustível.
          </p>
          <ul className="space-y-3">
            {itens.map(({ item, regrasAtuais, canonicos, bloqueadores }) => (
              <li key={item.id}>
                <ItemDaFilaCard
                  item={item}
                  modalidades={modalidades}
                  regrasAtuais={regrasAtuais}
                  canonicos={canonicos}
                  bloqueadores={bloqueadores}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
