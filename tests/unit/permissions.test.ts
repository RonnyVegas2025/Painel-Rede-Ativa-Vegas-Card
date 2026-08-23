import { describe, expect, it } from "vitest";
import { ALL_ROLES } from "@/constants/roles";
import { can, isReadOnly } from "@/lib/permissions/can";
import { COMERCIAL_FORBIDDEN, PERMISSIONS, type Permission } from "@/lib/permissions/matrix";

const TODAS = Object.keys(PERMISSIONS) as Permission[];

describe("consultor de campo", () => {
  it("reserva e abre ocorrencia", () => {
    expect(can("consultor_campo", "visitas.reservar")).toBe(true);
    expect(can("consultor_campo", "ocorrencias.abrir")).toBe(true);
    expect(can("consultor_campo", "bloqueio.solicitar")).toBe(true);
  });

  it("NUNCA aprova bloqueio", () => {
    // Separacao estrutural: quem observa nao decide.
    expect(can("consultor_campo", "bloqueio.aprovar")).toBe(false);
  });

  it("nao transfere reserva nem concede excecao a si mesmo", () => {
    expect(can("consultor_campo", "visitas.transferir")).toBe(false);
    expect(can("consultor_campo", "visitas.excecao_checkin")).toBe(false);
  });

  it("nao altera parametro nem gerencia usuario", () => {
    expect(can("consultor_campo", "configuracoes.editar_operacional")).toBe(false);
    expect(can("consultor_campo", "usuarios.gerenciar")).toBe(false);
  });
});

describe("supervisor de rede", () => {
  it("distribui e transfere", () => {
    expect(can("supervisor_rede", "visitas.transferir")).toBe(true);
    expect(can("supervisor_rede", "acoes.criar")).toBe(true);
    expect(can("supervisor_rede", "visitas.excecao_checkin")).toBe(true);
  });

  it("nao aprova bloqueio: isso e do administrativo", () => {
    expect(can("supervisor_rede", "bloqueio.aprovar")).toBe(false);
  });
});

describe("administrativo", () => {
  it("analisa e decide", () => {
    expect(can("administrativo", "ocorrencias.analisar")).toBe(true);
    expect(can("administrativo", "bloqueio.aprovar")).toBe(true);
    expect(can("administrativo", "auditoria.ler")).toBe(true);
  });

  it("nao ve localizacao da equipe em tempo real", () => {
    expect(can("administrativo", "localizacao.ver_equipe")).toBe(false);
  });

  it("nao mexe em parametro estrutural nem em usuarios", () => {
    expect(can("administrativo", "configuracoes.editar_estrutural")).toBe(false);
    expect(can("administrativo", "usuarios.gerenciar")).toBe(false);
  });
});

describe("comercial", () => {
  it("ve cobertura e relatorios", () => {
    expect(can("comercial", "estabelecimentos.ler")).toBe(true);
    expect(can("comercial", "relatorios.comerciais")).toBe(true);
  });

  it.each(COMERCIAL_FORBIDDEN)("nunca acessa %s", (permissao) => {
    expect(can("comercial", permissao)).toBe(false);
  });

  it("nao ve evidencia de visita nem localizacao", () => {
    expect(can("comercial", "visitas.ver_evidencias")).toBe(false);
    expect(can("comercial", "localizacao.ver_equipe")).toBe(false);
  });
});

describe("consulta", () => {
  const ESCRITA: Permission[] = [
    "estabelecimentos.editar", "modalidades.editar", "segmentos.editar",
    "acoes.criar", "visitas.reservar", "visitas.transferir",
    "ocorrencias.abrir", "ocorrencias.analisar",
    "bloqueio.solicitar", "bloqueio.aprovar",
    "importacao.executar", "usuarios.gerenciar",
    "configuracoes.editar_operacional", "configuracoes.editar_estrutural",
  ];

  it.each(ESCRITA)("nao pode %s", (permissao) => {
    expect(can("consulta", permissao)).toBe(false);
  });

  it("le o que lhe cabe", () => {
    expect(can("consulta", "estabelecimentos.ler")).toBe(true);
  });

  it("isReadOnly reconhece consulta e ausencia de papel", () => {
    expect(isReadOnly("consulta")).toBe(true);
    expect(isReadOnly(null)).toBe(true);
    expect(isReadOnly("consultor_campo")).toBe(false);
  });
});

describe("gestor master", () => {
  // Execucao de campo nao pertence ao gestor master: reservar, abrir ocorrencia e
  // solicitar bloqueio sao atos de quem esta na rua. O gestor administra a
  // operacao, nao a executa. Se ele precisar reservar, o caminho e criar um
  // acesso de consultor, e a auditoria registra quem de fato foi ao local.
  const EXECUCAO_DE_CAMPO: Permission[] = [
    "visitas.reservar",
    "ocorrencias.abrir",
    "bloqueio.solicitar",
  ];

  it("alcanca toda a matriz, exceto execucao de campo", () => {
    const semAcesso = TODAS.filter((p) => !can("gestor_master", p));
    expect(semAcesso.sort()).toEqual([...EXECUCAO_DE_CAMPO].sort());
  });

  it("decide e configura sem restricao", () => {
    expect(can("gestor_master", "bloqueio.aprovar")).toBe(true);
    expect(can("gestor_master", "usuarios.gerenciar")).toBe(true);
    expect(can("gestor_master", "configuracoes.editar_estrutural")).toBe(true);
    expect(can("gestor_master", "auditoria.ler")).toBe(true);
  });
});

describe("invariantes da matriz", () => {
  it("papel ausente nao ganha nada", () => {
    for (const p of TODAS) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
    }
  });

  it("aprovar bloqueio pertence somente a gestao", () => {
    const podem = ALL_ROLES.filter((r) => can(r, "bloqueio.aprovar"));
    expect(podem.sort()).toEqual(["administrativo", "gestor_master"]);
  });

  it("gerenciar usuarios pertence somente ao gestor master", () => {
    expect(ALL_ROLES.filter((r) => can(r, "usuarios.gerenciar"))).toEqual(["gestor_master"]);
  });

  it("toda permissao tem ao menos um papel", () => {
    for (const p of TODAS) {
      expect(ALL_ROLES.some((r) => can(r, p))).toBe(true);
    }
  });
});
