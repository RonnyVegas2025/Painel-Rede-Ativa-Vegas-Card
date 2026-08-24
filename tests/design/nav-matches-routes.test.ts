import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * A navegação e as páginas que existem de fato não podem divergir.
 *
 * A verificação falha nos DOIS sentidos, e o segundo é o que mais importa:
 *
 * 1. **Item habilitado sem página.** Era o estado até agora: a barra lateral
 *    anunciava nove rotas inexistentes, o Next prefetchava 404 para todas, e
 *    clicar levava a uma tela de erro.
 *
 * 2. **Página existente sem estar habilitada.** É o problema inverso, e o mais
 *    provável daqui em diante: alguém constrói `/mapa` na Sprint 2, esquece de
 *    virar a flag, e a funcionalidade fica invisível — sem erro, sem sintoma,
 *    sem ninguém perceber.
 *
 * Mesmo raciocínio de `types-match-schema.test.ts`: verificação que só olha uma
 * direção deixa passar a metade que ninguém está esperando.
 */
const APP = fileURLToPath(new URL("../../src/app", import.meta.url));

/** Segmento de grupo do App Router — `(dashboard)` não entra na URL. */
const isGrupo = (nome: string) => nome.startsWith("(") && nome.endsWith(")");
/** Rota dinâmica — `[id]`. Não é alvo de item de navegação. */
const isDinamico = (nome: string) => nome.startsWith("[");

/** Toda rota com `page.tsx`, na forma em que aparece na URL. */
function rotasComPagina(dir: string, prefixo = ""): string[] {
  const encontradas: string[] = [];

  if (existsSync(join(dir, "page.tsx"))) {
    encontradas.push(prefixo === "" ? "/" : prefixo);
  }

  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (!statSync(caminho).isDirectory()) continue;
    if (isDinamico(nome)) continue;
    encontradas.push(
      ...rotasComPagina(caminho, isGrupo(nome) ? prefixo : `${prefixo}/${nome}`),
    );
  }

  return encontradas;
}

const paginas = new Set(rotasComPagina(APP));
const naNavegacao = new Map(NAV_ITEMS.map((i) => [i.href, i]));

describe("navegação e páginas construídas", () => {
  it("a varredura encontrou páginas: sem isto o teste passaria por vacuidade", () => {
    expect(paginas.size).toBeGreaterThan(2);
  });

  it.each(NAV_ITEMS.filter((i) => i.enabled).map((i) => [i.href, i.label]))(
    "%s está habilitado e tem página",
    (href) => {
      expect(paginas.has(href)).toBe(true);
    },
  );

  it("nenhuma página construída ficou de fora da navegação", () => {
    // Rotas que existem mas não são itens de menu, por natureza.
    const foraDoMenu = new Set([
      "/", // raiz, redireciona
      "/login", // pré-sessão
      "/diagnostico", // ferramenta de instalação, alcançada por link direto
    ]);

    const orfas = [...paginas].filter((rota) => {
      if (foraDoMenu.has(rota)) return false;
      const item = naNavegacao.get(rota);
      // Página que existe e não está na navegação, ou está com enabled false:
      // funcionalidade invisível.
      return item === undefined || !item.enabled;
    });

    expect(orfas).toEqual([]);
  });
});
