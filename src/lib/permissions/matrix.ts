import { ROLES, type Role } from "@/constants/roles";

/**
 * Espelho em TypeScript da matriz de docs/permissions.md.
 *
 * Serve para a interface esconder o que o usuario nao pode fazer. NAO e controle
 * de acesso: quem decide e a RLS. Esta matriz existindo nao dispensa a policy, e
 * uma divergencia entre as duas e bug de interface, nunca brecha de seguranca.
 */
export const PERMISSIONS = {
  "estabelecimentos.ler": [
    ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO, ROLES.SUPERVISOR_REDE,
    ROLES.CONSULTOR_CAMPO, ROLES.SUPORTE_TECNICO, ROLES.COMERCIAL, ROLES.CONSULTA,
  ],
  "estabelecimentos.editar": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "modalidades.editar": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "segmentos.editar": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "acoes.criar": [ROLES.GESTOR_MASTER, ROLES.SUPERVISOR_REDE],
  "visitas.reservar": [ROLES.CONSULTOR_CAMPO, ROLES.SUPERVISOR_REDE],
  "visitas.transferir": [ROLES.GESTOR_MASTER, ROLES.SUPERVISOR_REDE],
  "visitas.excecao_checkin": [ROLES.GESTOR_MASTER, ROLES.SUPERVISOR_REDE],
  "visitas.ver_evidencias": [
    ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO, ROLES.SUPERVISOR_REDE,
    ROLES.CONSULTOR_CAMPO, ROLES.SUPORTE_TECNICO,
  ],
  "ocorrencias.abrir": [ROLES.CONSULTOR_CAMPO, ROLES.SUPERVISOR_REDE, ROLES.SUPORTE_TECNICO],
  "ocorrencias.analisar": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "bloqueio.solicitar": [ROLES.CONSULTOR_CAMPO, ROLES.SUPERVISOR_REDE],
  "bloqueio.aprovar": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "localizacao.ver_equipe": [ROLES.GESTOR_MASTER, ROLES.SUPERVISOR_REDE],
  "importacao.executar": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "usuarios.gerenciar": [ROLES.GESTOR_MASTER],
  "configuracoes.editar_operacional": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "configuracoes.editar_estrutural": [ROLES.GESTOR_MASTER],
  "auditoria.ler": [ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO],
  "relatorios.comerciais": [
    ROLES.GESTOR_MASTER, ROLES.ADMINISTRATIVO, ROLES.SUPERVISOR_REDE,
    ROLES.COMERCIAL, ROLES.CONSULTA,
  ],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * O que o comercial nunca ve. Redundante com a matriz acima de proposito: uma
 * lista explicita e mais dificil de furar por engano do que a ausencia de um
 * papel numa lista longa, e e o que o item de negocio pede ao pe da letra.
 */
export const COMERCIAL_FORBIDDEN: readonly Permission[] = [
  "localizacao.ver_equipe",
  "visitas.ver_evidencias",
  "ocorrencias.analisar",
  "bloqueio.solicitar",
  "bloqueio.aprovar",
  "auditoria.ler",
];
