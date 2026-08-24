"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { hasUnresolvedConflict } from "@/lib/business-rules/resolve-rule-migration";
import { listarBloqueadores } from "@/features/segmentos/services/fila";

export interface AcaoState {
  error: string | null;
  ok: boolean;
}

const VAZIO: AcaoState = { error: null, ok: false };

/**
 * `requirePermission` aqui é a SEGUNDA barreira, não a primeira. A primeira é a
 * RLS: as RPCs rodam com o papel de quem chama, e as policies de `segments` e
 * `product_segments` continuam valendo por dentro. Esta checagem existe para dar
 * mensagem em vez de erro de banco.
 */
async function comPermissao<T>(fn: () => Promise<T>): Promise<T> {
  await requirePermission("segmentos.editar");
  return fn();
}

function idsDe(formData: FormData, campo: string): string[] {
  return formData
    .getAll(campo)
    .map(String)
    .filter((v) => v.length > 0);
}

/** As duas listas vêm juntas: a tela envia o conjunto completo de modalidades. */
function modalidadesDe(formData: FormData) {
  return { allow: idsDe(formData, "allow"), deny: idsDe(formData, "deny") };
}

const uuid = z.string().uuid("Identificador inválido.");

export async function confirmarComoEsta(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const id = uuid.safeParse(formData.get("segmentId"));
    if (!id.success) return { ...VAZIO, error: id.error.issues[0]?.message ?? null };

    const { allow, deny } = modalidadesDe(formData);
    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_segment_confirm", {
      p_segment_id: id.data,
      p_allow: allow,
      p_deny: deny,
    });

    if (error) return { ...VAZIO, error: error.message };
    revalidatePath(ROUTES.SEGMENTOS);
    return { error: null, ok: true };
  });
}

const criarSchema = z.object({
  segmentId: uuid,
  normalizedName: z.string().trim().min(2, "O nome de exibição é obrigatório."),
  category: z.enum(["alimentacao", "combustivel", "farmacia", "refeicao", "servicos", "outros"]),
});

export async function criarComoProprio(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const parsed = criarSchema.safeParse({
      segmentId: formData.get("segmentId"),
      normalizedName: formData.get("normalizedName"),
      category: formData.get("category"),
    });
    if (!parsed.success) {
      return { ...VAZIO, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    const { allow, deny } = modalidadesDe(formData);
    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_segment_create", {
      p_segment_id: parsed.data.segmentId,
      p_normalized_name: parsed.data.normalizedName,
      p_category: parsed.data.category,
      p_allow: allow,
      p_deny: deny,
    });

    if (error) return { ...VAZIO, error: error.message };
    revalidatePath(ROUTES.SEGMENTOS);
    return { error: null, ok: true };
  });
}

/**
 * Mapear para um canônico.
 *
 * A checagem de conflito acontece **de novo aqui**, e não só na tela: o estado
 * pode ter mudado entre carregar a página e enviar o formulário, e uma migração
 * silenciosa sobre decisão contrária é exatamente o erro caro que o
 * `resolve-rule-migration` existe para evitar.
 */
export async function mapearParaCanonico(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const segmentId = uuid.safeParse(formData.get("segmentId"));
    const canonicalId = uuid.safeParse(formData.get("canonicalId"));
    if (!segmentId.success) return { ...VAZIO, error: "Segmento inválido." };
    if (!canonicalId.success) {
      return { ...VAZIO, error: "Escolha o segmento canônico." };
    }

    const migrate = idsDe(formData, "migrate");
    const discard = idsDe(formData, "discard");

    const decisoes = await listarBloqueadores(segmentId.data, canonicalId.data);
    const decididas = new Set([...migrate, ...discard]);
    const pendentes = decisoes.filter((d) => !decididas.has(d.cardProductId));

    if (pendentes.length > 0) {
      return {
        ...VAZIO,
        error:
          `Resolva antes as regras de: ${pendentes.map((d) => d.cardProductName).join(", ")}. ` +
          "Com o alias, quem governa passa a ser o canônico, e essas regras ficariam visíveis e sem efeito.",
      };
    }

    // Conflito de intenção só é migrável depois de alguém escolher qual prevalece.
    const conflitosMigrados = decisoes.filter(
      (d) => d.outcome === "conflito" && migrate.includes(d.cardProductId),
    );
    if (hasUnresolvedConflict(conflitosMigrados) && formData.get("conflitoResolvido") !== "1") {
      return {
        ...VAZIO,
        error:
          `Conflito de intenção em: ${conflitosMigrados.map((d) => d.cardProductName).join(", ")}. ` +
          "O canônico tem a regra contrária. Confirme qual prevalece antes de migrar.",
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_segment_map", {
      p_segment_id: segmentId.data,
      p_canonical_id: canonicalId.data,
      p_migrate: migrate,
      p_discard: discard,
    });

    if (error) return { ...VAZIO, error: error.message };
    revalidatePath(ROUTES.SEGMENTOS);
    return { error: null, ok: true };
  });
}

export async function desativarSegmento(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const id = uuid.safeParse(formData.get("segmentId"));
    if (!id.success) return { ...VAZIO, error: "Segmento inválido." };

    // Segmento inativo sai de TODAS as modalidades, não só da que motivou a
    // revisão. A tela mostra a contagem e exige a confirmação explícita.
    if (formData.get("confirmado") !== "1") {
      return { ...VAZIO, error: "Confirme a desativação antes de aplicar." };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("resolve_segment_deactivate", {
      p_segment_id: id.data,
    });

    if (error) return { ...VAZIO, error: error.message };
    revalidatePath(ROUTES.SEGMENTOS);
    return { error: null, ok: true };
  });
}
