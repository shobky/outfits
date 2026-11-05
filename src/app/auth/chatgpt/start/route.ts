import { NextResponse } from "next/server";
import { beginSignIn, loopbackAddress } from "@/lib/chatgpt/oauth";
import { TX_COOKIE } from "@/lib/chatgpt/session";

/** The "Continue with ChatGPT" button lands here and goes on to OpenAI. */
export async function GET(request: Request) {
  const address = loopbackAddress(request);
  const { searchParams, pathname, search } = new URL(request.url);
  if (!address) return NextResponse.redirect(new URL("/login?error=chatgpt-hosted", request.url));
  // Cookies belong to one host, and OpenAI only redirects to 127.0.0.1, so the whole flow starts there.
  if (!address.isCanonical) return NextResponse.redirect(`${address.origin}${pathname}${search}`);

  const { url, tx } = beginSignIn(address.origin, { newAccount: searchParams.get("account") === "new" });
  const response = NextResponse.redirect(url);
  response.cookies.set(TX_COOKIE, Buffer.from(JSON.stringify(tx)).toString("base64url"), { httpOnly: true, sameSite: "lax", path: "/auth", maxAge: 600 });
  return response;
}
