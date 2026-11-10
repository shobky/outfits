import "server-only";
import { getRepo, unauthorized } from "@/lib/data";

/** Serializes personal reference edits and AI work across serverless instances. */
export async function withTryOnLease(work: () => Promise<Response>) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const token = crypto.randomUUID();
  let acquired = false;
  try {
    acquired = await repo.acquireTryOnLease(token);
    if (!acquired) return Response.json({ error: "Your fitting room is busy. Wait for the current upload or preview, then try again." }, { status: 409 });
    return await work();
  } catch (error) {
    console.error("[try-on] request failed", error);
    return Response.json({ error: "Your fitting room is temporarily unavailable. Please try again." }, { status: 503 });
  } finally {
    if (acquired) await repo.releaseTryOnLease(token).catch((error) => console.error("[try-on] lease release failed", error));
  }
}
