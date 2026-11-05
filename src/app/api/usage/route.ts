import { getRepo, unauthorized } from "@/lib/data";
import { getUsage } from "@/lib/usage";

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json(await getUsage(repo));
}
