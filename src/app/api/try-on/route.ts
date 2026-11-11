import { withTryOnLease } from "@/lib/intake/tryon-lock";
import { getRepo, unauthorized } from "@/lib/data";
import { hasFeature } from "@/lib/features";
import { record } from "@/lib/intake/budget";
import { limitsFromEnv } from "@/lib/intake/limits";
import { renderTryOn } from "@/lib/intake/tryon";
import { limitsAreOff } from "@/lib/usage";
import { envNumber } from "@/lib/usage-rules";
import { z } from "zod";
import { readShopProductImage } from "@/lib/shop/service";
import type { TryOnRun } from "@/lib/types";
import sharp from "sharp";
import { after } from "next/server";
import { notifyTryOnReady } from "@/lib/push";

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
  // Image generation is an explicit, feature-gated action. Its API key is
  // independent of the connection selected for text chat (including a plan).
  if (!process.env.OPENAI_API_KEY?.trim()) return Response.json({ error: "Try-on needs an OpenAI image API key configured on this server. A ChatGPT connection alone cannot generate these previews.", code: "image_api_not_configured" }, { status: 503 });
  const multipart = req.headers.get("content-type")?.includes("multipart/form-data");
  const form = multipart ? await req.formData().catch(() => null) : null;
  const body = multipart ? (() => { try { return JSON.parse(String(form?.get("payload"))); } catch { return null; } })() : await req.json().catch(() => null);
  const reference = form?.get("reference");
  if (multipart && (!(reference instanceof Blob) || !reference.type.startsWith("image/") || !reference.size || reference.size > 4.4 * 1024 * 1024)) return Response.json({ error: "Choose an image smaller than 4.4MB." }, { status: 400 });
  const parsed = z.object({ item_ids: z.array(z.string().min(1)).max(MAX_PIECES).optional(), product: productSchema.optional(), selected_size: z.string().trim().max(80).optional(), recreate_id: z.string().uuid().optional(), chat_id: z.string().uuid().optional(), tool_call_id: z.string().max(200).optional() }).strict().safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose up to four pieces or one store product." }, { status: 400 });
  const { item_ids, product, recreate_id, chat_id, tool_call_id } = parsed.data;
  if (reference && recreate_id) return Response.json({ error: "Choose a new look to use a different reference." }, { status: 400 });
  if (chat_id && !(await repo.getChat(chat_id))) return Response.json({ error: "Save this conversation before generating its preview." }, { status: 409 });
  if ([Boolean(item_ids?.length), Boolean(product), Boolean(recreate_id)].filter(Boolean).length !== 1) return Response.json({ error: "Choose wardrobe pieces, one store product, or a saved preview." }, { status: 400 });
  if (tryOnInFlight.has(repo.userId)) return Response.json({ error: "A try-on is already being made. You can start another when it finishes." }, { status: 409 });
  if (product && shopInFlight.has(repo.userId)) return Response.json({ error: "Your product preview is already being made." }, { status: 409 });
  tryOnInFlight.add(repo.userId);
  if (product) shopInFlight.add(repo.userId);
  try {
    const profile = await repo.getProfile();
    if (!(await limitsAreOff(repo))) {
      const [used, spent] = await Promise.all([repo.tryOnsToday(), repo.aiSpendToday()]);
      if (used >= tryOnDailyLimit()) return Response.json({ error: `That's today's ${tryOnDailyLimit()} try-ons. More tomorrow.` }, { status: 429 });
      if (spent >= limitsFromEnv().dailyBudget) return Response.json({ error: "Try-on is resting until tomorrow." }, { status: 429 });
    }
    if (recreate_id) {
      const previous = await repo.getTryOnRun(recreate_id);
      if (!previous) return Response.json({ error: "Saved preview not found." }, { status: 404 });
      const recipe = previous.recipe;
      const [person, identity, garments] = await Promise.all([repo.readPrivateImage(recipe.person_url), Promise.all(recipe.identity_urls.map((url) => repo.readPrivateImage(url))), Promise.all(recipe.garment_urls.map((url) => repo.readPrivateImage(url)))]);
      const { image, usd, model } = await renderTryOn(person, garments, { identity, fitNotes: recipe.fit_context, garmentNotes: recipe.garment_context });
      await record(repo, "try_on", usd);
      return await saveResult(repo, image, person, identity, garments, { ...recipe, cost_usd: usd, model, ...(chat_id ? { chat_id, ...(tool_call_id ? { tool_call_id } : {}) } : {}) });
    }
    const requestedIds = item_ids ? [...new Set(item_ids)] : [];
    const items = product ? [] : await repo.getItems(requestedIds.slice(0, MAX_PIECES));
    if (!product && items.length !== requestedIds.length) return Response.json({ error: "One or more selected pieces aren't in your wardrobe." }, { status: 400 });
    if (!product && items.some((item) => !item.image_url)) return Response.json({ error: "Every selected piece needs a photo before you try it on." }, { status: 400 });
    const photos = Array.isArray(profile.try_on_photos) ? profile.try_on_photos : [];
    const primary = profile.try_on_photo_url || photos.find((p) => p?.kind === "full_body")?.url;
    if (!primary && !reference) return Response.json({ error: "Add a full-body photo of yourself first", code: "needs_photo" }, { status: 400 });
    let oneOff: Buffer | null = null;
    if (reference instanceof Blob) {
      const input = sharp(Buffer.from(await reference.arrayBuffer()), { limitInputPixels: 25_000_000, failOn: "error" });
      oneOff = await input.autoOrient().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    }
    const identityRefs = (oneOff ? [] : photos)
      .filter((photo) => photo && photo.url && photo.url !== primary && (photo.kind === "face" || photo.kind === "side"))
      .slice(0, 2);
    const [person, ...identityAndGarments] = await Promise.all([
      oneOff ?? readProfileImage(repo, primary!),
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
      !oneOff && profile.try_on_insights && `User-confirmed visual proportion notes: ${JSON.stringify(profile.try_on_insights)}`,
    ].filter(Boolean).join(". ");
    const garmentContext = items.map((item, index) => `Garment ${index + 1}: ${JSON.stringify({ name: item.name, size: item.size, fit: item.fit, material: item.material, dimensions: item.garment_dimensions ?? "Unknown physical dimensions", photo_geometry: item.photo_geometry ?? null, notes: item.notes })}`).join("\n") || `Retailer garment: ${JSON.stringify({ selected_size: parsed.data.selected_size || "unknown", size_source: "user selection, not verified retailer measurements", url: product?.url })}. Physical measurements unknown. A size label alone does not establish fit; preserve the source silhouette.`;
    const { image, usd, model } = await renderTryOn(person, garments, { identity, fitNotes: savedFitContext, garmentNotes: garmentContext });
    await record(repo, "try_on", usd);
    return await saveResult(repo, image, person, identity, garments, { item_ids: requestedIds, ...(product ? { product } : {}), person_url: "", identity_urls: [], garment_urls: [], fit_context: savedFitContext, garment_context: garmentContext, title: product ? "Shop try-on" : items.map((item) => item.name).join(" + "), cost_usd: usd, model, ...(chat_id ? { chat_id, ...(tool_call_id ? { tool_call_id } : {}) } : {}) });
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

async function saveResult(repo: NonNullable<Awaited<ReturnType<typeof getRepo>>>, image: Buffer, person: Buffer, identity: Buffer[], garments: Buffer[], recipe: TryOnRun["recipe"]) {
  const uploaded: string[] = [];
  const store = async (bytes: Buffer) => {
    const jpeg = await sharp(bytes).autoOrient().flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    const url = await repo.uploadPrivateImage(new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "jpg", "result");
    uploaded.push(url);
    return url;
  };
  try {
    // Sequential uploads ensure cleanup can account for every successful write.
    const result_url = await store(image);
    const person_url = await store(person);
    const identity_urls: string[] = [], garment_urls: string[] = [];
    for (const bytes of identity) identity_urls.push(await store(bytes));
    for (const bytes of garments) garment_urls.push(await store(bytes));
    const run = await repo.saveTryOnRun({ result_url, recipe: { ...recipe, person_url, identity_urls, garment_urls } });
    after(() => notifyTryOnReady(repo));
    return Response.json({ url: result_url, run });
  } catch (error) {
    await Promise.allSettled(uploaded.map((url) => repo.deletePrivateImage(url)));
    throw error;
  }
}

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json({ runs: await repo.listTryOnRuns() });
}

/** Explicit deletion only; closing a dialog never deletes account history. */
export async function DELETE(req: Request) {
  return withTryOnLease(async () => {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a valid preview." }, { status: 400 });
  const run = await repo.getTryOnRun(parsed.data.id);
  if (!run) return Response.json({ error: "Saved preview not found." }, { status: 404 });
  const files = [run.result_url, run.recipe.person_url, ...run.recipe.identity_urls, ...run.recipe.garment_urls];
  for (const url of files) await repo.deletePrivateImage(url);
  await repo.deleteTryOnRun(run.id);
  return Response.json({ ok: true });
  });
}
