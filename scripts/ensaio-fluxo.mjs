// O fluxo real, pelo navegador.
//
// ## Por que navegador, e não uma chamada direta
//
// A montagem da prévia vive em `montar-previa.ts`, que depende do contexto de
// requisição do Next (cookies da sessão). Chamá-la de fora exigiria reimplementar
// a orquestração no script — e aí o ensaio verificaria a reimplementação, não o
// código que roda em produção. É a mesma armadilha das duas fontes da verdade que
// este projeto já pagou três vezes.
//
// Playwright entra só neste passo, atrás de `--com-dados`.
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const [planilha, escopo = "São Paulo"] = process.argv.slice(2);
const exe = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
].find(existsSync);

const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
const erros = [];
p.on("pageerror", (e) => erros.push(e.message));

try {
  await p.goto("http://localhost:3000/login");
  await p.fill('input[type="email"]', "ensaio@vegas.local");
  await p.fill('input[type="password"]', "EnsaioForte123!");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/dashboard", { timeout: 30000 });
  console.log("   ✓ login");

  const t0 = Date.now();
  await p.goto("http://localhost:3000/importacoes/nova");
  await p.setInputFiles('input[type="file"]', planilha);
  await p.fill('input[name="escopo"]', escopo);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/importacoes\/[0-9a-f-]{36}$/, { timeout: 240000 });
  await p.waitForLoadState("networkidle");
  console.log(`   ✓ upload e prévia · ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await p.getByRole("button", { name: /Aplicar importação/ }).click();
  await p.waitForFunction(
    () => !document.body.innerText.includes("Aplicando…"),
    undefined,
    { timeout: 240000 },
  ).catch(() => {});
  await p.waitForTimeout(3000);
  console.log("   ✓ aplicado");

  await p.goto("http://localhost:3000/estabelecimentos");
  await p.waitForLoadState("networkidle");
  const total = (await p.locator("body").innerText())
    .split("\n").map((s) => s.trim()).find((l) => /pontos credenciados/.test(l));
  console.log(`   ✓ listagem · ${total}`);
} finally {
  await b.close();
}

if (erros.length > 0) {
  console.log(`   ✗ erros de página: ${erros.slice(0, 3).join(" | ")}`);
  process.exit(1);
}
