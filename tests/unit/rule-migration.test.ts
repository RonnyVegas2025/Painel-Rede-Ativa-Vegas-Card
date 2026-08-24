import { describe, expect, it } from "vitest";
import {
  hasUnresolvedConflict,
  resolveRuleMigration,
  resolveRuleMigrations,
  type RuleToMigrate,
} from "@/lib/business-rules/resolve-rule-migration";

const regra = (
  aliasRule: RuleToMigrate["aliasRule"],
  canonicalRule: RuleToMigrate["canonicalRule"],
): RuleToMigrate => ({
  cardProductId: "p1",
  cardProductName: "Farmácia",
  aliasRule,
  canonicalRule,
});

describe("resolveRuleMigration", () => {
  it("canonico sem regra para a modalidade: migra direto", () => {
    expect(resolveRuleMigration(regra("allow", null)).outcome).toBe("migrar");
    expect(resolveRuleMigration(regra("deny", null)).outcome).toBe("migrar");
  });

  it("canonico com regra igual: nada a fazer, o efeito ja existe", () => {
    expect(resolveRuleMigration(regra("allow", "allow")).outcome).toBe("ja_existe");
    expect(resolveRuleMigration(regra("deny", "deny")).outcome).toBe("ja_existe");
  });

  it("canonico com regra contraria: conflito de intencao, nao de dados", () => {
    // Nenhuma das duas e obviamente certa. Escolher pelo operador aqui seria
    // decidir em silencio o que alguem decidiu diferente em dois lugares.
    expect(resolveRuleMigration(regra("allow", "deny")).outcome).toBe("conflito");
    expect(resolveRuleMigration(regra("deny", "allow")).outcome).toBe("conflito");
  });

  it("preserva a modalidade na decisao, para a tela poder nomea-la", () => {
    const d = resolveRuleMigration(regra("allow", "deny"));
    expect(d.cardProductName).toBe("Farmácia");
    expect(d.aliasRule).toBe("allow");
    expect(d.canonicalRule).toBe("deny");
  });
});

describe("hasUnresolvedConflict", () => {
  it("nao bloqueia quando tudo e migrar ou ja existe", () => {
    const d = resolveRuleMigrations([regra("allow", null), regra("deny", "deny")]);
    expect(hasUnresolvedConflict(d)).toBe(false);
  });

  it("bloqueia quando ha um conflito, mesmo entre varios resolviveis", () => {
    const d = resolveRuleMigrations([
      regra("allow", null),
      regra("allow", "deny"),
      regra("deny", "deny"),
    ]);
    expect(hasUnresolvedConflict(d)).toBe(true);
  });

  it("lista vazia nao bloqueia: segmento sem regra mapeia direto", () => {
    expect(hasUnresolvedConflict([])).toBe(false);
  });
});
