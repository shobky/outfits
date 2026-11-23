import { getRepo, unauthorized } from "@/lib/data";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { limitsAreOff } from "@/lib/usage";

/** Where the browser should send a photo. Direct to storage, which avoids Vercel's 4.5MB body limit and a second hop. */
export async function POST() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  // Same allowance as the multipart handler: every upload path counts against it.
  if (!(await limitsAreOff(repo)) && !(await rateLimit("upload", 20, 600))) return rateLimited();
  try {
    return Response.json(await repo.createUploadTarget("jpg"));
  } catch (e) {
    console.error("[upload target]", e);
    return Response.json({ error: `Storage isn't accepting uploads: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
