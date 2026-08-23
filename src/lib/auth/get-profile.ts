import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/user";

/**
 * Perfil do usuario da requisicao. cache() do React deduplica na mesma requisicao,
 * entao varios componentes podem chamar sem multiplicar consulta.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, team_id, phone, is_active, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    teamId: data.team_id,
    phone: data.phone,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
});
