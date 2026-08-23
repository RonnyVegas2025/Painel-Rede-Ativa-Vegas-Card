/** Papeis do sistema. Espelha o enum user_role do banco. */
export const ROLES = {
  GESTOR_MASTER: "gestor_master",
  ADMINISTRATIVO: "administrativo",
  SUPERVISOR_REDE: "supervisor_rede",
  CONSULTOR_CAMPO: "consultor_campo",
  SUPORTE_TECNICO: "suporte_tecnico",
  COMERCIAL: "comercial",
  CONSULTA: "consulta",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  gestor_master: "Gestor master",
  administrativo: "Administrativo",
  supervisor_rede: "Supervisor de rede",
  consultor_campo: "Consultor de campo",
  suporte_tecnico: "Suporte técnico",
  comercial: "Comercial",
  consulta: "Consulta",
};

/** Papel padrao de quem entra. O mais restrito: promocao e ato explicito. */
export const DEFAULT_ROLE: Role = ROLES.CONSULTA;

export const ALL_ROLES = Object.values(ROLES) as readonly Role[];
