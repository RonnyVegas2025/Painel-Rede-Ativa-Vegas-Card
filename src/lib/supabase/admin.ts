import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente com service_role: IGNORA RLS POR COMPLETO.
 *
 * Uso restrito a worker e importacao no servidor. O import de "server-only" acima
 * faz o build quebrar se este arquivo for puxado por um Client Component, em vez
 * de vazar a chave para o navegador em silencio.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
