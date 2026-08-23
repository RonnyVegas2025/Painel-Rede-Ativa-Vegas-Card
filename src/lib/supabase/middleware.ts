import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_ROUTES, ROUTES } from "@/constants/routes";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser e nao getSession: getUser valida o token no servidor. getSession
  // apenas le o cookie, que o cliente controla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.LOGIN;
    url.searchParams.set("proximo", path);
    return NextResponse.redirect(url);
  }

  if (user && path === ROUTES.LOGIN) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.DASHBOARD;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
