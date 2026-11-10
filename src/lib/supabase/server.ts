import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/** Standard @supabase/ssr server client (from Supabase's Next.js guide). */
export async function createClient(response?: Pick<NextResponse, "cookies">) {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Route handlers pass their redirect response so the auth session
          // survives the redirect. Server Components still rely on proxy.ts.
          response?.cookies.set(name, value, options);
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component — proxy.ts refreshes sessions, safe to ignore.
          }
        });
      },
    },
  });
}
