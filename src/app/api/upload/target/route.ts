import { getRepo, unauthorized } from "@/lib/data";

/** Where the browser should send a photo. Direct to storage, which avoids Vercel's 4.5MB body limit and a second hop. */
export async function POST() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  try {
    return Response.json(await repo.createUploadTarget("jpg"));
  } catch (e) {
    console.error("[upload target]", e);
    return Response.json({ error: `Storage isn't accepting uploads: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
