import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * As diretivas `"use server"` e `"use client"` são regra do **Next**, não do
 * TypeScript — e por isso nem o `tsc` nem o `next build` as verificam.
 *
 * ## O defeito que originou este arquivo
 *
 * `export const VAZIO = { error: null, ok: false }` num arquivo `"use server"`.
 * Compilou, passou no typecheck, passou no build — e derrubou o módulo INTEIRO na
 * primeira vez que a rota foi renderizada:
 *
 *     A "use server" file can only export async functions, found object.
 *
 * Foi o navegador que encontrou. Dos três defeitos daquela etapa, os outros dois
 * já tinham guarda: a amarração tipo↔schema pegou a defasagem de colunas, e a
 * constraint pegou `confirmed_at` sem autor. Este passou por não haver nada
 * olhando.
 *
 * ## O que se verifica aqui
 *
 * A classe inteira, não a instância. Arquivo com `"use server"` só exporta função
 * assíncrona; arquivo de ação nunca é `"use client"`; e nenhum arquivo carrega as
 * duas diretivas.
 */
const SRC = fileURLToPath(new URL("../../src", import.meta.url));

function arquivos(dir: string): string[] {
  const encontrados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) encontrados.push(...arquivos(caminho));
    else if (/\.tsx?$/.test(nome)) encontrados.push(caminho);
  }
  return encontrados;
}

const TODOS = arquivos(SRC).map((caminho) => ({
  caminho: relative(SRC, caminho),
  conteudo: readFileSync(caminho, "utf8"),
}));

/** A diretiva só vale no topo do arquivo — depois disso é uma string qualquer. */
function diretiva(conteudo: string): "server" | "client" | null {
  const primeira = conteudo
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "" && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
  if (primeira === '"use server";' || primeira === "'use server';") return "server";
  if (primeira === '"use client";' || primeira === "'use client';") return "client";
  return null;
}

/**
 * Exportações que NÃO são função assíncrona em tempo de execução.
 *
 * `export type` e `export interface` são apagados na compilação e não chegam ao
 * Next. `export const x = async () => {}` É uma função em execução, e passa —
 * a regra do Next é sobre o valor exportado, não sobre a sintaxe.
 */
function exportacoesInvalidas(conteudo: string): string[] {
  const problemas: string[] = [];
  for (const linha of conteudo.split("\n")) {
    const l = linha.trim();
    if (!l.startsWith("export")) continue;
    if (/^export\s+(type|interface)\b/.test(l)) continue;
    if (/^export\s+async\s+function\b/.test(l)) continue;
    if (/^export\s+(const|let|var)\s+\w+(\s*:[^=]+)?\s*=\s*async\b/.test(l)) continue;
    if (/^export\s*\{\s*type\s/.test(l)) continue;
    problemas.push(l.replace(/\s+/g, " ").slice(0, 80));
  }
  return problemas;
}

describe("diretivas do Next", () => {
  it("a varredura encontrou arquivos: sem isto o teste passaria por vacuidade", () => {
    expect(TODOS.length).toBeGreaterThan(20);
    expect(TODOS.filter((a) => diretiva(a.conteudo) === "server").length).toBeGreaterThan(0);
  });

  it("arquivo `use server` só exporta função assíncrona", () => {
    const violacoes = TODOS.filter((a) => diretiva(a.conteudo) === "server")
      .map((a) => ({ caminho: a.caminho, invalidas: exportacoesInvalidas(a.conteudo) }))
      .filter((v) => v.invalidas.length > 0);

    // Constante, objeto, classe ou função síncrona exportada dali derruba o
    // módulo inteiro em execução — não só a exportação em questão.
    expect(violacoes).toEqual([]);
  });

  it("nenhum arquivo carrega as duas diretivas", () => {
    const ambas = TODOS.filter(
      (a) => /^\s*["']use server["'];/m.test(a.conteudo) && /^\s*["']use client["'];/m.test(a.conteudo),
    ).map((a) => a.caminho);
    expect(ambas).toEqual([]);
  });

  it("arquivo de ações é `use server`, nunca `use client`", () => {
    // O caminho inverso, e o mais provável: `"use client"` num arquivo de ações
    // transforma as ações em funções de cliente sem erro nenhum — elas
    // simplesmente deixam de rodar no servidor, e a RLS deixa de ser aplicada
    // com o papel certo.
    const errados = TODOS.filter((a) => /(^|\/)actions\.tsx?$/.test(a.caminho))
      .filter((a) => diretiva(a.conteudo) !== "server")
      .map((a) => `${a.caminho}: ${diretiva(a.conteudo) ?? "sem diretiva"}`);
    expect(errados).toEqual([]);
  });
});
