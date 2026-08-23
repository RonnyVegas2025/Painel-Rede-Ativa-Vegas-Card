import type { Role } from "@/constants/roles";
import { COMERCIAL_FORBIDDEN, PERMISSIONS, type Permission } from "./matrix";

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "comercial" && COMERCIAL_FORBIDDEN.includes(permission)) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function canAny(role: Role | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** consulta e somente leitura: nenhuma permissao de escrita, em nenhum caminho. */
export function isReadOnly(role: Role | null | undefined): boolean {
  return role === "consulta" || !role;
}
