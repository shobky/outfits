import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAccess, inviteOnly } from "@/lib/access";

/**
 * Refreshes the Supabase session cookie and gates the app behind login.
 * In demo mode (no Supabase env vars) everything is open.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/privacy");
  const isInvite = path.startsWith("/invite") || path.startsWith("/api/invite");

  if (!data.user && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return NextResponse.redirect(login);
  }
  // API routes are checked once, in getRepo, next to the data. Pages are redirected here.
  if (data.user && !isPublic && !isInvite && !path.startsWith("/api/") && !(await hasAccess(supabase as never, data.user))) {
    const next = request.nextUrl.clone();
    next.pathname = inviteOnly() ? "/invite" : "/login";
    next.search = inviteOnly() ? "" : "?error=denied";
    return NextResponse.redirect(next);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|demo/|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)"],
};
