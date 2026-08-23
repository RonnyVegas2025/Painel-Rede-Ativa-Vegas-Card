import "server-only";

import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import type { Role } from "@/constants/roles";
import { can } from "@/lib/permissions/can";
import type { Permission } from "@/lib/permissions/matrix";
import { getProfile } from "./get-profile";
import type { Profile } from "@/types/user";

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(ROUTES.LOGIN);
  if (!profile.isActive) redirect(`${ROUTES.LOGIN}?motivo=inativo`);
  return profile;
}

/**
 * Segunda barreira, no servidor. A primeira e a RLS; esta evita renderizar a tela.
 * Esconder o botao e a terceira, e a menos importante.
 */
export async function requireRole(...roles: readonly Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(`${ROUTES.DASHBOARD}?erro=sem_permissao`);
  return profile;
}

export async function requirePermission(permission: Permission): Promise<Profile> {
  const profile = await requireProfile();
  if (!can(profile.role, permission)) redirect(`${ROUTES.DASHBOARD}?erro=sem_permissao`);
  return profile;
}
