import { z } from "zod";
import { getRepo, unauthorized } from "@/lib/data";
import { allowedPushEndpoint } from "@/lib/push-rules";
import { pushConfigured } from "@/lib/push";

const base64Url = (bytes: number) => z.string().regex(/^[A-Za-z0-9_-]+$/).max(256).refine((value) => {
  try { return Buffer.from(value, "base64url").byteLength === bytes; } catch { return false; }
}, "Invalid push key");

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine(allowedPushEndpoint, "Unsupported push service"),
  keys: z.object({ p256dh: base64Url(65), auth: base64Url(16) }),
});

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (!pushConfigured()) return Response.json({ error: "Push delivery is not configured yet." }, { status: 503 });
  const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That push subscription is invalid." }, { status: 400 });
  const existing = await repo.listPushSubscriptions();
  if (existing.length >= 10 && !existing.some((item) => item.endpoint === parsed.data.endpoint)) return Response.json({ error: "Remove an old device before enabling another." }, { status: 409 });
  await repo.savePushSubscription({ endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth });
  return Response.json({ ok: true });
}

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json({ configured: pushConfigured(), endpoints: pushConfigured() ? (await repo.listPushSubscriptions()).map((item) => item.endpoint) : [] }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const body = z.object({ endpoint: z.string().url().max(2048) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "That push subscription is invalid." }, { status: 400 });
  await repo.deletePushSubscription(body.data.endpoint);
  return Response.json({ ok: true });
}
