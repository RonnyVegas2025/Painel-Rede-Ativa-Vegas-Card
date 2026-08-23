import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/constants/routes";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("proximo") ?? ROUTES.DASHBOARD;

  // Redirecionar so para caminho interno: "proximo" vem da URL e e controlado
  // pelo cliente. Aceitar URL absoluta aqui e open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.DASHBOARD;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}${ROUTES.LOGIN}?motivo=link_invalido`);
}
