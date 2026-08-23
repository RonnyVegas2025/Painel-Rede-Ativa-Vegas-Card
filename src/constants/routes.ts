export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  DIAGNOSTICO: "/diagnostico",
  ACOES: "/acoes",
  MAPA: "/mapa",
  ESTABELECIMENTOS: "/estabelecimentos",
  MINHAS_VISITAS: "/minhas-visitas",
  ATENCAO: "/atencao",
  IMPORTACOES: "/importacoes",
  PRODUTOS: "/produtos",
  SEGMENTOS: "/segmentos",
  USUARIOS: "/usuarios",
  RELATORIOS: "/relatorios",
  CONFIGURACOES: "/configuracoes",
} as const;

export const acaoRoute = (id: string) => `/acoes/${id}` as const;
export const estabelecimentoRoute = (id: string) => `/estabelecimentos/${id}` as const;

/** Rotas alcancaveis sem sessao. Tudo o mais passa pelo middleware. */
export const PUBLIC_ROUTES: readonly string[] = ["/login", "/auth/callback"];
