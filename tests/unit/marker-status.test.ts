import { describe, expect, it } from "vitest";
import {
  resolveMarkerStatus,
  type EstablishmentStatusSet,
} from "@/lib/business-rules/resolve-marker-status";

const base: EstablishmentStatusSet = {
  registration: "ativo",
  operational: "apto",
  transaction: "recente",
  visit: null,
  occurrence: null,
};

describe("resolveMarkerStatus", () => {
  it("prioridade 4: sem nada acontecendo, a cor e a recencia", () => {
    const r = resolveMarkerStatus({ ...base, transaction: "critico" });
    expect(r.priority).toBe("transacional");
    expect(r.colorToken).toBe("--vg-status-critico");
  });

  it("prioridade 3: pendencia operacional supera a recencia", () => {
    const r = resolveMarkerStatus({
      ...base,
      transaction: "critico",
      operational: "problema_tecnico",
    });
    expect(r.priority).toBe("pendencia");
  });

  it("prioridade 3: ocorrencia em analise tambem conta", () => {
    expect(resolveMarkerStatus({ ...base, occurrence: "em_analise" }).priority).toBe("pendencia");
  });

  it("ocorrencia resolvida nao gera pendencia", () => {
    expect(resolveMarkerStatus({ ...base, occurrence: "resolvida" }).priority).toBe("transacional");
  });

  it("prioridade 2: visita ativa supera pendencia", () => {
    const r = resolveMarkerStatus({
      ...base,
      operational: "problema_tecnico",
      occurrence: "aberta",
      visit: "em_atendimento",
    });
    expect(r.priority).toBe("visita_ativa");
    expect(r.colorToken).toBe("--vg-status-reservado");
  });

  it("visita concluida nao e visita ativa", () => {
    expect(resolveMarkerStatus({ ...base, visit: "concluida" }).priority).toBe("transacional");
  });

  it("visita expirada nao e visita ativa", () => {
    expect(resolveMarkerStatus({ ...base, visit: "expirada" }).priority).toBe("transacional");
  });

  it("prioridade 1: bloqueio supera tudo, inclusive visita ativa", () => {
    const r = resolveMarkerStatus({
      registration: "bloqueado",
      operational: "problema_tecnico",
      transaction: "recente",
      visit: "em_atendimento",
      occurrence: "aberta",
    });
    expect(r.priority).toBe("indisponivel");
    expect(r.colorToken).toBe("--vg-status-bloqueado");
  });

  it("suspenso e indisponivel", () => {
    expect(resolveMarkerStatus({ ...base, operational: "suspenso" }).priority).toBe("indisponivel");
  });

  it("encerrado e indisponivel", () => {
    expect(resolveMarkerStatus({ ...base, operational: "encerrado" }).priority).toBe("indisponivel");
  });

  it("bloqueio_solicitado e pendencia, NAO indisponibilidade", () => {
    // Pedido pendente: o estabelecimento continua operando ate a decisao do
    // administrativo. Tratar como bloqueado aqui derrubaria comercio ativo.
    const r = resolveMarkerStatus({ ...base, operational: "bloqueio_solicitado" });
    expect(r.priority).toBe("pendencia");
  });

  it("fechado_temporariamente nao e encerrado", () => {
    const r = resolveMarkerStatus({ ...base, operational: "fechado_temporariamente" });
    expect(r.priority).not.toBe("indisponivel");
  });

  it("todo resultado traz um motivo em texto para o aria-label", () => {
    expect(resolveMarkerStatus(base).reason.length).toBeGreaterThan(0);
  });
});
