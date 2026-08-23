import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * UI Standard §24: hexadecimal somente no arquivo canônico de tokens.
 *
 * Um "#4D56A1" solto num componente é o começo da divergência que o padrão
 * existe para evitar: quando o token mudar, aquele componente fica para trás e
 * ninguém percebe. Regra de lint sintática daria falso positivo em outros usos
 * de "#", então a verificação vive aqui.
 */
const SRC = fileURLToPath(new URL("../../src", import.meta.url));

const PERMITIDOS = [
  join(SRC, "styles", "tokens.css"),   // fonte canônica
  join(SRC, "app", "layout.tsx"),      // themeColor precisa de literal no metadata
];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return listar(caminho);
    return /\.(tsx?|css)$/.test(nome) ? [caminho] : [];
  });
}

describe("nenhum hexadecimal fora do arquivo de tokens", () => {
  const arquivos = listar(SRC).filter((f) => !PERMITIDOS.includes(f));

  it("varre o código inteiro", () => {
    expect(arquivos.length).toBeGreaterThan(30);
  });

  it.each(arquivos.map((f) => [f.replace(`${SRC}/`, ""), f]))("%s", (_rotulo, caminho) => {
    const conteudo = readFileSync(caminho, "utf8");
    const achados = (conteudo.match(HEX) ?? []).filter(
      // "#" em rota, âncora ou fragmento de URL não é cor.
      (h) => !/^#(fff|000)$/i.test(h) || true,
    );
    expect(achados).toEqual([]);
  });
});

describe("componentes usam apenas tokens --vg-*", () => {
  const arquivos = listar(join(SRC, "components"));

  it.each(arquivos.map((f) => [f.replace(`${SRC}/`, ""), f]))(
    "%s não referencia token --color-* legado",
    (_rotulo, caminho) => {
      const conteudo = readFileSync(caminho, "utf8");
      expect(conteudo).not.toMatch(/var\(--color-/);
    },
  );
});

describe("regra de dependência entre camadas", () => {
  // PLATFORM-STANDARDS.md §3: a dependência é sempre para baixo.
  // constants é a camada mais baixa e não importa nada do projeto.
  const arquivos = listar(join(SRC, "constants"));

  it.each(arquivos.map((f) => [f.replace(`${SRC}/`, ""), f]))(
    "%s não importa de camadas acima",
    (_rotulo, caminho) => {
      const conteudo = readFileSync(caminho, "utf8");
      expect(conteudo).not.toMatch(/from ["']@\/(components|features|app|lib)\//);
    },
  );
});
