import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isEmailAllowed } from "../access";
import { getRepo, isSupabaseConfigured } from "../data";
import { finishSignIn, loopbackAddress, saveAccount, SignInError, type Transaction } from "./oauth";

export const TX_COOKIE = "chatgpt_signin";

export const canCreateSession = () => !isSupabaseConfigured() || !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Supabase can't accept OpenAI's identity directly, so a verified ChatGPT email is
 * turned into a one-time sign-in server side. The user receives no email from this.
 */
async function createSupabaseSession(email: string) {
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw error ?? new Error("Supabase returned no sign-in link");
  const { createClient } = await import("../supabase/server");
  const { error: verifyError } = await (await createClient()).auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verifyError) throw verifyError;
}

/** Runs the whole return from OpenAI. Returns the path to continue to. */
export async function completeChatGPTSignIn(request: Request, encodedTx: string) {
  if (!loopbackAddress(request)) return "/login?error=chatgpt-hosted";
  try {
    const tx = JSON.parse(Buffer.from(encodedTx, "base64url").toString("utf8")) as Transaction;
    const signIn = await finishSignIn(new URL(request.url).searchParams, tx);

    // Someone already signed in is linking a plan to their account, whichever email it uses.
    const current = await getRepo();
    if (current) return saveAccount(current.userId, signIn).firstTime ? "/?chatgpt=welcome" : "/";

    if (!canCreateSession()) return "/login?error=chatgpt-setup";
    if (!signIn.email || !signIn.emailVerified) return "/login?error=chatgpt-email";
    if (!isEmailAllowed(signIn.email)) return "/login?error=denied";
    await createSupabaseSession(signIn.email);
    const repo = await getRepo();
    if (!repo) return "/login?error=chatgpt-failed";
    return saveAccount(repo.userId, signIn).firstTime ? "/?chatgpt=welcome" : "/";
  } catch (e) {
    if (e instanceof SignInError && e.code === "cancelled") return "/login?error=chatgpt-cancelled";
    console.error("[chatgpt] sign-in failed:", e instanceof Error ? e.message : "unknown error");
    return "/login?error=chatgpt-failed";
  }
}
