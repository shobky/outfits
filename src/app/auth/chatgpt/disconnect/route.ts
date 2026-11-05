import { disconnect, loopbackAddress } from "@/lib/chatgpt/oauth";
import { getRepo, unauthorized } from "@/lib/data";

export async function POST(request: Request) {
  if (!loopbackAddress(request)) return Response.json({ error: "Not available here" }, { status: 404 });
  // Local mode has no login, so another site must not be able to trigger this.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json(await disconnect(repo.userId));
}
