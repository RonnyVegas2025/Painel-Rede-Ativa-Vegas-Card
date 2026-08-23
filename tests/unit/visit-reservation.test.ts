import { describe, expect, it } from "vitest";
import {
  blocksNewReservation,
  calculateReservationExpiry,
  canReserve,
  isReservationExpired,
  minutesRemaining,
} from "@/lib/business-rules/calculate-visit-reservation";
import { VISIT_ACTIVE_STATUSES } from "@/constants/visit-status";

const NOW = new Date("2026-08-02T12:00:00Z");

describe("calculateReservationExpiry", () => {
  it("soma os minutos configurados", () => {
    expect(calculateReservationExpiry(NOW, 60).toISOString()).toBe("2026-08-02T13:00:00.000Z");
  });

  it("recusa valor invalido em vez de criar reserva ja vencida", () => {
    expect(() => calculateReservationExpiry(NOW, 0)).toThrow(RangeError);
    expect(() => calculateReservationExpiry(NOW, -10)).toThrow(RangeError);
    expect(() => calculateReservationExpiry(NOW, Number.NaN)).toThrow(RangeError);
  });
});

describe("isReservationExpired", () => {
  const passado = new Date("2026-08-02T11:00:00Z");
  const futuro = new Date("2026-08-02T13:00:00Z");

  it("reservada com prazo vencido esta expirada", () => {
    expect(isReservationExpired("reservada", passado, NOW)).toBe(true);
  });

  it("reservada dentro do prazo nao esta", () => {
    expect(isReservationExpired("reservada", futuro, NOW)).toBe(false);
  });

  it("check-in interrompe a expiracao", () => {
    // O consultor ja esta no local: expirar aqui liberaria o ponto para outro
    // enquanto ele atende.
    expect(isReservationExpired("checkin_realizado", passado, NOW)).toBe(false);
    expect(isReservationExpired("em_atendimento", passado, NOW)).toBe(false);
  });

  it("em deslocamento ainda expira", () => {
    expect(isReservationExpired("em_deslocamento", passado, NOW)).toBe(true);
  });

  it("sem prazo nao expira", () => {
    expect(isReservationExpired("reservada", null, NOW)).toBe(false);
  });
});

describe("minutesRemaining", () => {
  it("arredonda para cima", () => {
    expect(minutesRemaining(new Date("2026-08-02T12:30:30Z"), NOW)).toBe(31);
  });

  it("nunca devolve negativo", () => {
    expect(minutesRemaining(new Date("2026-08-02T11:00:00Z"), NOW)).toBe(0);
  });
});

describe("blocksNewReservation", () => {
  it.each(VISIT_ACTIVE_STATUSES)("%s bloqueia", (status) => {
    expect(blocksNewReservation(status)).toBe(true);
  });

  it.each(["concluida", "cancelada", "expirada"] as const)("%s libera", (status) => {
    expect(blocksNewReservation(status)).toBe(false);
  });

  it("os quatro estados ativos batem com o indice parcial do banco", () => {
    // Divergir daqui e da clausula WHERE do indice significa a interface
    // prometer o que a RPC vai negar.
    expect([...VISIT_ACTIVE_STATUSES]).toEqual([
      "reservada", "em_deslocamento", "checkin_realizado", "em_atendimento",
    ]);
  });
});

describe("canReserve", () => {
  const ok = {
    activeReservationsOfConsultant: 1,
    maximumActiveReservations: 3,
    establishmentHasActiveVisit: false,
    establishmentIsAvailable: true,
  };

  it("libera quando tudo esta em ordem", () => {
    expect(canReserve(ok).allowed).toBe(true);
  });

  it("recusa estabelecimento indisponivel antes de qualquer outra checagem", () => {
    const r = canReserve({ ...ok, establishmentIsAvailable: false, establishmentHasActiveVisit: true });
    expect(r.denial).toBe("estabelecimento_indisponivel");
  });

  it("recusa ponto com visita ativa — exclusividade global", () => {
    // Vale mesmo que a outra visita seja de outra acao ou modalidade (ADR 0002).
    expect(canReserve({ ...ok, establishmentHasActiveVisit: true }).denial).toBe("ja_reservado");
  });

  it("recusa no limite de reservas do consultor", () => {
    const r = canReserve({ ...ok, activeReservationsOfConsultant: 3 });
    expect(r.denial).toBe("limite_atingido");
    expect(r.message).toContain("3");
  });

  it("toda recusa explica o que fazer", () => {
    const r = canReserve({ ...ok, activeReservationsOfConsultant: 3 });
    expect(r.message).toMatch(/Conclua/);
  });
});
