import { getRepo, unauthorized } from "@/lib/data";
import { getUsage, isDeveloper } from "@/lib/usage";

/** Developer switches. body: { limits_off: boolean } */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (!isDeveloper(repo)) return Response.json({ error: "Developers only" }, { status: 403 });
  const { limits_off } = (await req.json().catch(() => ({}))) as { limits_off?: unknown };
  if (typeof limits_off !== "boolean") return Response.json({ error: "limits_off must be true or false" }, { status: 400 });
  await repo.updateProfile({ limits_off });
  return Response.json(await getUsage(repo));
}
