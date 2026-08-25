"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/require-role";
import type { AcaoState } from "@/features/importacao/acao";
import { createClient } from "@/lib/supabase/server";
import { montarPrevia } from "@/features/importacao/services/montar-previa";
import { TAMANHO_MAXIMO_BYTES } from "@/features/importacao/services/ler-planilha";
import {
  avaliarConfirmacao,
  mensagemDeRecontagem,
  normalizarQuantidade,
} from "@/lib/business-rules/confirmacao-deliberada";


const uuid = z.string().uuid("Identificador inválido.");

/**
 * `requirePermission` é a SEGUNDA barreira. A primeira é a RLS: as RPCs são
 * `security invoker` e as policies valem por dentro. Esta checagem existe para dar
 * mensagem em vez de erro de banco.
 */
async function comPermissao<T>(fn: (perfilId: string) => Promise<T>): Promise<T> {
  const perfil = await requirePermission("importacao.executar");
  return fn(perfil.id);
}

const BUCKET = "import-files";

/**
 * Cria a importação e monta a prévia.
 *
 * O job nasce ANTES do upload, com o caminho derivado do id. Se o operador
 * abandonar no meio, o objeto no bucket sempre aponta de volta para um job — e o
 * descarte fecha os dois.
 */
export async function criarImportacao(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const arquivo = formData.get("arquivo");
    const escopo = String(formData.get("escopo") ?? "").trim();

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { error: "Selecione o arquivo da planilha.", ok: false };
    }
    if (escopo === "") {
      return {
        error:
          "Informe a cidade do escopo. Sem ela, os ausentes seriam calculados sobre a base inteira.",
        ok: false,
      };
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      return {
        error: `Arquivo com ${(arquivo.size / 1024 / 1024).toFixed(1)} MB excede o limite de 20 MB.`,
        ok: false,
      };
    }

    const supabase = await createClient();
    const { data: job, error: erroJob } = await supabase.rpc("import_create_preview", {
      p_file_name: arquivo.name,
      p_scope_city: escopo,
    });
    if (erroJob || !job) return { error: erroJob?.message ?? "Falha ao criar a importação.", ok: false };

    const conteudo = Buffer.from(await arquivo.arrayBuffer());

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET)
      .upload(job.storage_path, conteudo, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false,
      });
    if (erroUpload) {
      // Descarta o job em vez de deixar um pendente sem arquivo na lista — dois
      // estados indistinguíveis de novo.
      await supabase.rpc("import_discard", {
        p_import_id: job.id,
        p_motivo: `falha ao enviar o arquivo: ${erroUpload.message}`,
      });
      return { error: `Falha ao enviar o arquivo: ${erroUpload.message}`, ok: false };
    }

    try {
      await montarPrevia(job.id, conteudo);
    } catch (e) {
      await supabase.rpc("import_discard", {
        p_import_id: job.id,
        p_motivo: `falha ao montar a prévia: ${e instanceof Error ? e.message : String(e)}`,
      });
      return { error: e instanceof Error ? e.message : String(e), ok: false };
    }

    revalidatePath(ROUTES.IMPORTACOES);
    redirect(`${ROUTES.IMPORTACOES}/${job.id}`);
  });
}

export async function descartarImportacao(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { error: id.error.issues[0]!.message, ok: false };

    const motivo = String(formData.get("motivo") ?? "").trim();
    const supabase = await createClient();
    const { error } = await supabase.rpc("import_discard", {
      p_import_id: id.data,
      p_motivo: motivo === "" ? "descartada na revisão da prévia" : motivo,
    });
    if (error) return { error: error.message, ok: false };

    revalidatePath(ROUTES.IMPORTACOES);
    return { error: null, ok: true };
  });
}

/**
 * Redeclarar escopo: descartar e recomeçar numa ação.
 *
 * Sem isto, o caminho certo tem quatro passos — descartar, voltar à lista, subir
 * 20 MB de novo, declarar o escopo — e o errado tem um: digitar o número. Enquanto
 * o errado for mais curto, tornar a saída visível não adianta.
 *
 * DOIS TEMPOS: a original só é descartada quando a cópia do arquivo dá certo.
 * Descartar antes deixaria o operador sem nenhum dos dois, com os 20 MB já
 * enviados.
 */
export async function redeclararEscopo(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async () => {
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { error: id.error.issues[0]!.message, ok: false };

    const escopo = String(formData.get("escopo") ?? "").trim();
    const observacao = String(formData.get("observacao") ?? "").trim();

    const supabase = await createClient();

    const { data: antigo } = await supabase
      .from("import_jobs")
      .select("storage_path")
      .eq("id", id.data)
      .maybeSingle();
    if (!antigo) return { error: "Importação não encontrada.", ok: false };

    // 1º tempo: cria a derivada. A original continua intacta.
    const { data: novo, error: erroNovo } = await supabase.rpc("import_redeclare_scope", {
      p_import_id: id.data,
      p_scope_city: escopo,
      p_observacao: observacao === "" ? undefined : observacao,
    });
    if (erroNovo || !novo) return { error: erroNovo?.message ?? "Falha ao redeclarar.", ok: false };

    // 2º tempo: copia o objeto. Cópia, não reaproveitamento — cada job mantém seu
    // artefato imutável, que é o que "evidência" significa.
    const { error: erroCopia } = await supabase.storage
      .from(BUCKET)
      .copy(antigo.storage_path, novo.storage_path);

    if (erroCopia) {
      await supabase.rpc("import_discard", {
        p_import_id: novo.id,
        p_motivo: `cópia do arquivo falhou: ${erroCopia.message}`,
      });
      return {
        error: `Não foi possível copiar o arquivo: ${erroCopia.message}. A prévia original continua intacta.`,
        ok: false,
      };
    }

    const { data: baixado } = await supabase.storage.from(BUCKET).download(novo.storage_path);
    if (!baixado) {
      await supabase.rpc("import_discard", {
        p_import_id: novo.id,
        p_motivo: "arquivo copiado não pôde ser lido",
      });
      return { error: "O arquivo copiado não pôde ser lido. A prévia original continua intacta.", ok: false };
    }

    try {
      await montarPrevia(novo.id, Buffer.from(await baixado.arrayBuffer()));
    } catch (e) {
      await supabase.rpc("import_discard", {
        p_import_id: novo.id,
        p_motivo: `falha ao montar a prévia redeclarada: ${e instanceof Error ? e.message : String(e)}`,
      });
      return { error: e instanceof Error ? e.message : String(e), ok: false };
    }

    // 3º: só agora a original cai.
    await supabase.rpc("import_finish_redeclaration", { p_novo_id: novo.id });

    revalidatePath(ROUTES.IMPORTACOES);
    redirect(`${ROUTES.IMPORTACOES}/${novo.id}`);
  });
}

/**
 * Aplicar.
 *
 * A quantidade digitada é conferida contra o número que o SERVIDOR conta AGORA,
 * não contra o que a tela renderizou. Se a base mudou entre as duas coisas, o
 * operador aprovou um número que não existe mais — mesmo TOCTOU da colisão de
 * regra do E-004.
 */
export async function aplicarImportacao(
  _prev: AcaoState,
  formData: FormData,
): Promise<AcaoState> {
  return comPermissao(async (perfilId) => {
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { error: id.error.issues[0]!.message, ok: false };

    const supabase = await createClient();

    const { data: resumo, error: erroResumo } = await supabase.rpc("import_absent_summary", {
      p_import_id: id.data,
    });
    if (erroResumo || !resumo) {
      return { error: erroResumo?.message ?? "Falha ao recontar os ausentes.", ok: false };
    }

    const r = resumo as Record<string, unknown>;
    const ausentes = Number(r.ausentes ?? 0);
    const excede = Boolean(r.excede);

    const mostrado = normalizarQuantidade(String(formData.get("mostrado") ?? ""));
    if (excede && mostrado !== null && mostrado !== ausentes) {
      return { error: mensagemDeRecontagem(mostrado, ausentes), ok: false };
    }

    const estado = avaliarConfirmacao({
      ausentes,
      excede,
      digitado: String(formData.get("quantidade") ?? ""),
    });
    if (!estado.podeAplicar) {
      return {
        error: estado.erro ?? `Digite ${ausentes.toLocaleString("pt-BR")} para confirmar.`,
        ok: false,
      };
    }

    if (excede) {
      // `confirmed_by` e `confirmed_at` andam juntos: a constraint
      // `import_jobs_confirmacao_completa` exige que sejam ambos nulos ou ambos
      // preenchidos. Confirmação sem autor não é confirmação — é um carimbo.
      const { error } = await supabase
        .from("import_jobs")
        .update({
          requires_confirmation: true,
          confirmed_at: new Date().toISOString(),
          confirmed_by: perfilId,
        })
        .eq("id", id.data);
      if (error) return { error: error.message, ok: false };
    }

    const { error } = await supabase.rpc("import_commit", { p_import_id: id.data });
    if (error) return { error: error.message, ok: false };

    revalidatePath(ROUTES.IMPORTACOES);
    return { error: null, ok: true };
  });
}
