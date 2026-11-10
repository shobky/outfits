import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeChatGPTSignIn, TX_COOKIE } from "@/lib/chatgpt/session";
import { loopbackAddress } from "@/lib/chatgpt/oauth";
import { createClient } from "@/lib/supabase/server";

const EMAIL_TYPES = new Set(["email", "magiclink"]);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function tokenHashLanding(tokenHash: string, tokenType: string) {
  const token = escapeHtml(tokenHash);
  const type = escapeHtml(tokenType);
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in to Outfits</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:15vh auto;padding:2rem;line-height:1.5"><h1>Continue to Outfits</h1><p>Press the button to finish signing in. This extra step keeps email security scanners from using your one-time link first.</p><form method="post" action="/auth/callback"><input type="hidden" name="token_hash" value="${token}"><input type="hidden" name="type" value="${type}"><button type="submit" style="border:0;border-radius:999px;background:#151515;color:#fff;padding:.8rem 1.4rem;font:inherit;cursor:pointer">Sign in</button></form></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}

/** Both ways in return here: Supabase's magic link, and ChatGPT, whose redirect must use this exact path. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const store = await cookies();
  const pending = store.get(TX_COOKIE)?.value;
  if (pending && searchParams.has("state")) {
    const next = await completeChatGPTSignIn(request, pending);
    store.delete({ name: TX_COOKIE, path: "/auth" });
    // OpenAI's callback is loopback-only. Use the validated canonical loopback
    // origin when available, and never construct a redirect from an arbitrary Host header.
    const callbackOrigin = loopbackAddress(request)?.origin ?? origin;
    return NextResponse.redirect(`${callbackOrigin}${next}`);
  }

  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  if (tokenHash && tokenType && EMAIL_TYPES.has(tokenType)) return tokenHashLanding(tokenHash, tokenType);

  const code = searchParams.get("code");
  if (code) {
    const callbackOrigin = loopbackAddress(request)?.origin ?? origin;
    const response = NextResponse.redirect(`${callbackOrigin}/`, 303);
    const supabase = await createClient(response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

/** Explicitly consumes token-hash links after the person presses the button. */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const callbackOrigin = loopbackAddress(request)?.origin ?? origin;
  const requestOrigin = request.headers.get("origin");
  const redirect = (url: string) => NextResponse.redirect(url, 303);
  try {
    if (requestOrigin && requestOrigin !== origin && requestOrigin !== callbackOrigin) return redirect(`${callbackOrigin}/login?error=auth`);
    const form = await request.formData();
    const tokenHash = form.get("token_hash");
    const tokenType = form.get("type");
    if (typeof tokenHash !== "string" || typeof tokenType !== "string" || !EMAIL_TYPES.has(tokenType)) {
      return redirect(`${callbackOrigin}/login?error=auth`);
    }

    const response = NextResponse.redirect(`${callbackOrigin}/`, 303);
    const supabase = await createClient(response);
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
    if (!error) return response;
  } catch {
    // Keep the callback response deliberately generic; the login page explains
    // expired links without exposing auth-provider details.
  }
  return redirect(`${callbackOrigin}/login?error=auth`);
}
