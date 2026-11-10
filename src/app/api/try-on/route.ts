import { withTryOnLease } from "@/lib/intake/tryon-lock";
import { getRepo, unauthorized } from "@/lib/data";
import { hasFeature } from "@/lib/features";
import { resolveAI } from "@/lib/ai/provider";
import { record } from "@/lib/intake/budget";
import { limitsFromEnv } from "@/lib/intake/limits";
import { renderTryOn } from "@/lib/intake/tryon";
import { limitsAreOff } from "@/lib/usage";
import { envNumber } from "@/lib/usage-rules";
import { z } from "zod";
import { readShopProductImage } from "@/lib/shop/service";

export const maxDuration = 180;
const MAX_PIECES = 4;
const tryOnDailyLimit = () => envNumber(process.env.TRY_ON_DAILY_LIMIT, 5);
const productSchema = z.object({ url: z.string().url().max(2048), image_url: z.string().url().max(2048) }).strict();
const shopInFlight = new Set<string>();
const tryOnInFlight = new Set<string>();

async function readProfileImage(repo: Awaited<ReturnType<typeof getRepo>>, url: string) {
  if (!repo) throw new Error("Unauthorized");
  try {
    return await repo.readPrivateImage(url);
  } catch {
    return repo.readImage(url); // legacy wardrobe upload, still ownership checked
  }
}

/** body: { item_ids }. Dresses the person's saved photo in these pieces. */
export async function POST(req: Request) { return withTryOnLease(() => post(req)); }
async function post(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (!(await hasFeature(repo, "try_on"))) return Response.json({ error: "Try-on isn't switched on for your account" }, { status: 403 });
  if (resolveAI(repo.userId).source !== "key") return Response.json({ error: "Try-on isn't available here" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const parsed = z.object({ item_ids: z.array(z.string().min(1)).max(MAX_PIECES).optional(), product: productSchema.optional() }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose up to four pieces or one store product." }, { status: 400 });
  const { item_ids, product } = parsed.data;
  if ((!item_ids?.length && !product) || (item_ids?.length && product)) return Response.json({ error: "Choose wardrobe pieces or one store product." }, { status: 400 });
  if (tryOnInFlight.has(repo.userId)) return Response.json({ error: "A try-on is already being made. You can start another when it finishes." }, { status: 409 });
  if (product && shopInFlight.has(repo.userId)) return Response.json({ error: "Your product preview is already being made." }, { status: 409 });
  tryOnInFlight.add(repo.userId);
  if (product) shopInFlight.add(repo.userId);
  try {
    const profile = await repo.getProfile();
    if (!profile.try_on_photo_url) return Response.json({ error: "Add a photo of yourself first", code: "needs_photo" }, { status: 400 });
    if (!(await limitsAreOff(repo))) {
      const [used, spent] = await Promise.all([repo.tryOnsToday(), repo.aiSpendToday()]);
      if (used >= tryOnDailyLimit()) return Response.json({ error: `That's today's ${tryOnDailyLimit()} try-ons. More tomorrow.` }, { status: 429 });
      if (spent >= limitsFromEnv().dailyBudget) return Response.json({ error: "Try-on is resting until tomorrow." }, { status: 429 });
    }
    const requestedIds = item_ids ? [...new Set(item_ids)] : [];
    const items = product ? [] : await repo.getItems(requestedIds.slice(0, MAX_PIECES));
    if (!product && items.length !== requestedIds.length) return Response.json({ error: "One or more selected pieces aren't in your wardrobe." }, { status: 400 });
    if (!product && items.some((item) => !item.image_url)) return Response.json({ error: "Every selected piece needs a photo before you try it on." }, { status: 400 });
    const photos = Array.isArray(profile.try_on_photos) ? profile.try_on_photos : [];
    const primary = profile.try_on_photo_url || photos.find((p) => p?.kind === "full_body")?.url;
    if (!primary) return Response.json({ error: "Add a full-body photo of yourself first", code: "needs_photo" }, { status: 400 });
    const identityRefs = photos
      .filter((photo) => photo && photo.url && photo.url !== primary && (photo.kind === "face" || photo.kind === "side"))
      .slice(0, 2);
    const [person, ...identityAndGarments] = await Promise.all([
      readProfileImage(repo, primary),
      ...identityRefs.map((photo) => readProfileImage(repo, photo.url)),
      ...(product ? [readShopProductImage(product.url, product.image_url)] : items.map((i) => repo.readImage(i.image_url!))),
    ]);
    const identity = identityAndGarments.slice(0, identityRefs.length);
    const garments = identityAndGarments.slice(identityRefs.length);
    const savedFitContext = [
      profile.height_cm && `User-provided height: ${profile.height_cm} cm`,
      profile.weight_kg && `User-provided weight: ${profile.weight_kg} kg`,
      profile.build && `User-provided build: ${profile.build}`,
      Object.keys(profile.sizes ?? {}).length ? `User-provided sizes: ${JSON.stringify(profile.sizes)}` : null,
      profile.notes && `User notes: ${profile.notes}`,
      profile.try_on_insights && `User-confirmed visual proportion notes: ${JSON.stringify(profile.try_on_insights)}`,
    ].filter(Boolean).join(". ");
    const { image, usd } = await renderTryOn(person, garments, { identity, fitNotes: savedFitContext });
    await record(repo, "try_on", usd);
    const url = await repo.uploadPrivateImage(new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "jpg", "result");
    return Response.json({ url });
  } catch (e) {
    console.error("[try-on]", e);
    const usd = (e as { usd?: number }).usd;
    if (usd) await record(repo, "try_on", usd);
    return Response.json({ error: "The try-on didn't work this time. Check the photo and try again." }, { status: 502 });
  } finally {
    tryOnInFlight.delete(repo.userId);
    if (product) shopInFlight.delete(repo.userId);
  }
}

/** body: { url }. Previews aren't kept once closed. */
export async function DELETE(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = z.object({ url: z.string().max(2048) }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid preview." }, { status: 400 });
  const { url } = parsed.data;
  // Results have their own purpose-scoped path. The repo validates ownership,
  // so a client cannot use this endpoint to delete a reference or wardrobe photo.
  if (url && /\/api\/try-on\/file\/result\//.test(url)) {
    await repo.deletePrivateImage(url).catch((e) => console.warn("[try-on] not removed", e));
  }
  return Response.json({ ok: true });
}
