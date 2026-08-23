import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Papel lido do claim do JWT, do mesmo jeito que a RLS le.
 *
 * Serve para diagnostico: se isto divergir de profiles.role, o token esta velho
 * e o usuario segue com o papel antigo ate o proximo refresh (ADR 0005).
 */
export async function getRoleFromClaims(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("auth_role");
  return error ? null : (data as string);
}
