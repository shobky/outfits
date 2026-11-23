import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Fixed-window burst control backed by the rate_limits table (serverless-safe:
 * no in-memory state). Fails open when the counter can't be reached so an
 * outage in this guard never takes the app down with it; the daily AI caps
 * still fail closed on their own.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) {
      console.error("[rate-limit]", error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error("[rate-limit]", e);
    return true;
  }
}

export const rateLimited = () =>
  Response.json({ error: "Slow down a little and try again in a few minutes.", code: "rate_limited" }, { status: 429 });
