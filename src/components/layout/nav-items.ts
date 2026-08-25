import {
  AlertTriangle, BarChart3, ClipboardList, FileSpreadsheet, LayoutDashboard,
  Map, Settings, Store, Tags, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import type { Permission } from "@/lib/permissions/matrix";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Sem permissão, o item não aparece. Não é segurança, é higiene de interface. */
  permission: Permission | null;
  /**
   * A rota tem página construída.
   *
   * Item habilitado sem página faz o Next prefetchar 404 e leva o usuário a uma
   * tela de erro ao clicar — a barra lateral anunciava nove rotas assim antes
   * desta flag. Página construída sem a flag é o problema inverso, e o mais
   * provável daqui em diante: alguém constrói `/mapa` na Sprint 2, esquece de
   * virar, e a funcionalidade fica invisível sem ninguém perceber.
   *
   * `tests/design/nav-matches-routes.test.ts` falha nos dois sentidos.
   */
  enabled: boolean;
  /** Cabe na barra inferior do celular: no máximo cinco. */
  mobile: boolean;
  group: "operacao" | "cadastros" | "administracao";
}

export const NAV_GROUPS: Record<NavItem["group"], string> = {
  operacao: "Operação",
  cadastros: "Cadastros",
  administracao: "Administração",
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: ROUTES.DASHBOARD, label: "Painel", icon: LayoutDashboard, permission: null, enabled: true, mobile: true, group: "operacao" },
  { href: ROUTES.MAPA, label: "Mapa", icon: Map, permission: "estabelecimentos.ler", enabled: false, mobile: true, group: "operacao" },
  { href: ROUTES.ACOES, label: "Ações", icon: ClipboardList, permission: "estabelecimentos.ler", enabled: false, mobile: true, group: "operacao" },
  { href: ROUTES.MINHAS_VISITAS, label: "Minhas visitas", icon: Store, permission: "visitas.reservar", enabled: false, mobile: true, group: "operacao" },
  { href: ROUTES.ATENCAO, label: "Atenção", icon: AlertTriangle, permission: "ocorrencias.analisar", enabled: false, mobile: true, group: "operacao" },

  { href: ROUTES.ESTABELECIMENTOS, label: "Estabelecimentos", icon: Store, permission: "estabelecimentos.ler", enabled: false, mobile: false, group: "cadastros" },
  { href: ROUTES.PRODUTOS, label: "Modalidades", icon: Wallet, permission: "modalidades.editar", enabled: false, mobile: false, group: "cadastros" },
  { href: ROUTES.SEGMENTOS, label: "Segmentos", icon: Tags, permission: "segmentos.editar", enabled: true, mobile: false, group: "cadastros" },

  { href: ROUTES.IMPORTACOES, label: "Importações", icon: FileSpreadsheet, permission: "importacao.executar", enabled: true, mobile: false, group: "administracao" },
  { href: ROUTES.RELATORIOS, label: "Relatórios", icon: BarChart3, permission: "relatorios.comerciais", enabled: false, mobile: false, group: "administracao" },
  { href: ROUTES.USUARIOS, label: "Usuários", icon: Users, permission: "usuarios.gerenciar", enabled: false, mobile: false, group: "administracao" },
  { href: ROUTES.CONFIGURACOES, label: "Configurações", icon: Settings, permission: "configuracoes.editar_operacional", enabled: false, mobile: false, group: "administracao" },
];
