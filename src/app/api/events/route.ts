import { getRepo, unauthorized } from "@/lib/data";
import { isEventName } from "@/lib/events";

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { name, props } = (await req.json().catch(() => ({}))) as { name?: unknown; props?: Record<string, unknown> };
  if (!isEventName(name)) return Response.json({ error: "Unknown event" }, { status: 400 });
  // Only short plain values, so nothing personal can be pasted in.
  const clean = Object.fromEntries(
    Object.entries(props ?? {})
      .filter(([, v]) => typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= 40))
      .slice(0, 8),
  );
  await repo.track(name, clean);
  return Response.json({ ok: true });
}
