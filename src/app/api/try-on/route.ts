import { getRepo, unauthorized } from "@/lib/data";
import { hasFeature } from "@/lib/features";
import { resolveAI } from "@/lib/ai/provider";
import { record } from "@/lib/intake/budget";
import { limitsFromEnv } from "@/lib/intake/limits";
import { renderTryOn } from "@/lib/intake/tryon";
import { limitsAreOff } from "@/lib/usage";
import { envNumber } from "@/lib/usage-rules";

export const maxDuration = 180;
const MAX_PIECES = 4;
const tryOnDailyLimit = () => envNumber(process.env.TRY_ON_DAILY_LIMIT, 5);

/** body: { item_ids }. Dresses the person's saved photo in these pieces. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (!(await hasFeature(repo, "try_on"))) return Response.json({ error: "Try-on isn't switched on for your account" }, { status: 403 });
  if (resolveAI(repo.userId).source !== "key") return Response.json({ error: "Try-on isn't available here" }, { status: 400 });
  const { item_ids } = (await req.json().catch(() => ({}))) as { item_ids?: string[] };
  if (!item_ids?.length) return Response.json({ error: "Choose at least one piece" }, { status: 400 });
  try {
    const profile = await repo.getProfile();
    if (!profile.try_on_photo_url) return Response.json({ error: "Add a photo of yourself first", code: "needs_photo" }, { status: 400 });
    if (!(await limitsAreOff(repo))) {
      const [used, spent] = await Promise.all([repo.tryOnsToday(), repo.aiSpendToday()]);
      if (used >= tryOnDailyLimit()) return Response.json({ error: `That's today's ${tryOnDailyLimit()} try-ons. More tomorrow.` }, { status: 429 });
      if (spent >= limitsFromEnv().dailyBudget) return Response.json({ error: "Try-on is resting until tomorrow." }, { status: 429 });
    }
    const items = (await repo.getItems(item_ids.slice(0, MAX_PIECES))).filter((i) => i.image_url);
    if (!items.length) return Response.json({ error: "These pieces don't have photos yet" }, { status: 400 });
    const [person, ...garments] = await Promise.all([repo.readImage(profile.try_on_photo_url), ...items.map((i) => repo.readImage(i.image_url!))]);
    const { image, usd } = await renderTryOn(person, garments);
    await record(repo, "try_on", usd);
    const url = await repo.uploadImage(new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "jpg");
    return Response.json({ url });
  } catch (e) {
    console.error("[try-on]", e);
    const usd = (e as { usd?: number }).usd;
    if (usd) await record(repo, "try_on", usd);
    return Response.json({ error: `The try-on didn't work: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}

/** body: { url }. Previews aren't kept once closed. */
export async function DELETE(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const profile = await repo.getProfile();
  if (url && url !== profile.try_on_photo_url) await repo.deleteImage(url).catch((e) => console.warn("[try-on] not removed", e));
  return Response.json({ ok: true });
}
