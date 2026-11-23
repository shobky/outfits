import "server-only";
import type { Repo } from "@/lib/data";

/**
 * Fixed-window burst control backed by the rate_limits table (serverless-safe:
 * no in-memory state). Fails open when the counter can't be reached so an
 * outage in this guard never takes the app down with it; the daily AI caps
 * still fail closed on their own.
 */
export async function rateLimit(repo: Repo, scope: string, max: number, windowSeconds: number): Promise<boolean> {
  return repo.rateLimitHit(scope, max, windowSeconds);
}

export const rateLimited = () =>
  Response.json({ error: "Slow down a little and try again in a few minutes.", code: "rate_limited" }, { status: 429 });
