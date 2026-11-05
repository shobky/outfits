import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeChatGPTSignIn, TX_COOKIE } from "@/lib/chatgpt/session";
import { createClient } from "@/lib/supabase/server";

/** Both ways in return here: Supabase's magic link, and ChatGPT, whose redirect must use this exact path. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const store = await cookies();
  const pending = store.get(TX_COOKIE)?.value;
  if (pending && searchParams.has("state")) {
    const next = await completeChatGPTSignIn(request, pending);
    store.delete({ name: TX_COOKIE, path: "/auth" });
    // Built from the Host header: request.url can name a different loopback host than the browser's cookies use.
    return NextResponse.redirect(`http://${request.headers.get("host")}${next}`);
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
