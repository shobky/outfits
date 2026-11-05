import { getRepo, unauthorized } from "@/lib/data";
import { isFeatureName } from "@/lib/features-shared";
import { getUsage, isDeveloper } from "@/lib/usage";

/** Developer switches. body: { limits_off: boolean } or { feature: name, on: boolean } */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (!isDeveloper(repo)) return Response.json({ error: "Developers only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { limits_off?: unknown; feature?: unknown; on?: unknown };
  if (typeof body.limits_off === "boolean") {
    await repo.updateProfile({ limits_off: body.limits_off });
  } else if (isFeatureName(body.feature) && typeof body.on === "boolean") {
    const mine = new Set((await repo.getProfile()).dev_features ?? []);
    if (body.on) mine.add(body.feature);
    else mine.delete(body.feature);
    await repo.updateProfile({ dev_features: [...mine] });
  } else {
    return Response.json({ error: "Send limits_off, or a known feature with on" }, { status: 400 });
  }
  return Response.json(await getUsage(repo));
}
