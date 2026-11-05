import "server-only";
import type { Repo } from "../data/repo";
import type { IntakeBatch, IntakeGroup, IntakeView, ItemImage, ItemInput } from "../types";
import { explainAIError, resolveAI } from "../ai/provider";
import { analyzePhotos, analyzeWorn, type AnalyzedGroup } from "./analyze";
import { hasFeature } from "../features";
import { canReadPhotos, checkStudio, record } from "./budget";
import { pickReferences } from "./references";
import { sortWornPieces } from "./worn-rules";
import { frameOriginal, restyle, studioEnabled } from "./studio";

/** Below this the piece waits for the owner instead of going straight into the drawer. */
const AUTO_ADD_CONFIDENCE = 0.75;
/** Two at a time keeps eight photos inside one function's time limit. */
const CONCURRENCY = 2;
export const MAX_PHOTOS = 8;

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

function draftOf(g: AnalyzedGroup): IntakeGroup["draft"] {
  return {
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    colors: g.colors as IntakeGroup["draft"]["colors"],
    pattern: g.pattern,
    material: g.material,
    fit: g.fit,
    seasons: g.seasons,
    occasions: g.occasions,
    formality: g.formality,
    warmth: g.warmth,
    brand: g.brand,
    size: null,
    notes: null,
  };
}

/** Without a key, each photo is its own piece and the owner fills in the details. */
function offlineGroups(count: number): AnalyzedGroup[] {
  return Array.from({ length: count }, (_, index) => ({
    photos: [{ index, view: "front" as const, rotation: 0 as const }],
    name: "",
    category: "top" as const,
    subcategory: "t-shirt",
    colors: [],
    pattern: "solid" as const,
    material: null,
    fit: null,
    seasons: [],
    occasions: [],
    formality: 2,
    warmth: 2,
    brand: null,
    description: "",
    facts: "",
    confidence: 0,
    question: null,
  })) as AnalyzedGroup[];
}

async function inPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

/** One photo of someone wearing clothes. Every new piece waits for review: its picture is reconstructed. */
async function runWornBatch(repo: Repo, batch: IntakeBatch) {
  const ai = resolveAI(repo.userId);
  if (ai.source !== "key") throw new Error("This needs AI that isn't available");
  if (!(await canReadPhotos(repo))) throw new Error("The daily AI budget has been reached. Please try again tomorrow");
  const photo = await repo.readImage(batch.photos[0]);
  const closetItems = await repo.listItems({});
  const closet = closetItems.slice(0, 200).map((i) => ({ id: i.id, name: i.name, type: `${i.category}/${i.subcategory}`, colors: i.colors }));
  const { analysis, usd } = await analyzeWorn(photo, closet, ai);
  if (usd) await record(repo, "vision", usd);
  const { matched, fresh } = sortWornPieces(analysis.pieces, new Set(closet.map((c) => c.id)));
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
  const groups = await repo.createIntakeGroups(
    fresh.map((p) => ({
      batch_id: batch.id,
      status: "queued" as const,
      worn: true,
      step: "Waiting its turn",
      views: [{ photo_url: batch.photos[0], view: "front" as const, rotation: 0, result_url: null, ai: false, error: null }],
      draft: draftOf({ ...p, formality: clamp(p.formality), warmth: clamp(p.warmth) } as unknown as AnalyzedGroup),
      description: p.description || null,
      facts: p.facts || null,
      confidence: p.confidence,
      question: analysis.question,
      note: null,
      error: null,
      item_id: null,
      cost_usd: 0,
    })),
  );
  await repo.updateIntakeBatch(batch.id, {
    status: "processing",
    cost_usd: usd,
    matched: matched.map((m) => ({ name: closetItems.find((i) => i.id === m.match_item_id)?.name ?? m.name, item_id: m.match_item_id! })),
    rejected: analysis.pieces.length ? [] : [{ url: batch.photos[0], reason: "We couldn't see any clothes clearly" }],
  });
  await inPool(groups, (g) => runGroup(repo, g));
  await repo.updateIntakeBatch(batch.id, { status: "done" });
}

export async function runBatch(repo: Repo, batch: IntakeBatch) {
  try {
    if (batch.kind === "worn") return await runWornBatch(repo, batch);
    const photos = await Promise.all(batch.photos.map((url) => repo.readImage(url)));
    const ai = resolveAI(repo.userId);
    // Budgets guard the owner's key. A person's own plan has its own limits.
    const useVision = ai.source === "plan" || (ai.source === "key" && (await canReadPhotos(repo)));
    const { analysis, usd } = useVision ? await analyzePhotos(photos, ai) : { analysis: { groups: offlineGroups(photos.length), rejected: [] }, usd: 0 };
    if (usd) await record(repo, "vision", usd);
    const groups = await repo.createIntakeGroups(
      analysis.groups.map((g) => ({
        batch_id: batch.id,
        status: "queued" as const,
        step: "Waiting its turn",
        views: g.photos.map((p): IntakeView => ({ photo_url: batch.photos[p.index], view: p.view, rotation: p.rotation, result_url: null, ai: false, error: null })),
        draft: draftOf(g),
        description: g.description || null,
        facts: g.facts || null,
        confidence: g.confidence,
        question: g.question,
        note: null,
        error: null,
        item_id: null,
        cost_usd: 0,
      })),
    );
    await repo.updateIntakeBatch(batch.id, {
      status: "processing",
      cost_usd: usd,
      rejected: analysis.rejected.map((r) => ({ url: batch.photos[r.index], reason: r.reason })),
    });
    await inPool(groups, (g) => runGroup(repo, g));
    await repo.updateIntakeBatch(batch.id, { status: "done" });
  } catch (e) {
    console.error("[intake] batch failed", e);
    await repo.updateIntakeBatch(batch.id, { status: "failed", error: `We couldn't read these photos: ${explainAIError(e)}` }).catch(console.error);
  }
}

/** Finishes one piece. A failure stays on this piece only, with a retry. */
export async function runGroup(repo: Repo, group: IntakeGroup) {
  const views: IntakeView[] = group.views.map((v) => ({ ...v, error: null }));
  const stale: string[] = [];
  let cost = Number(group.cost_usd) || 0;
  let note: string | null = null;
  const label = group.draft.name || "this piece";
  await repo.updateIntakeGroup(group.id, { status: "processing", error: null, step: `Styling ${label}` });
  const combine = views.length > 1 && (await hasFeature(repo, "multi_photo"));

  for (const v of views) {
    if (v.ai && v.result_url) continue; // an earlier good result: a retry shouldn't pay for it twice
    try {
      const photo = await repo.readImage(v.photo_url);
      if (v.result_url) stale.push(v.result_url);
      if (v.view === "detail") {
        v.result_url = await store(repo, await frameOriginal(photo, v.rotation));
        continue;
      }
      if (!studioEnabled(repo.userId)) {
        v.result_url = await store(repo, await frameOriginal(photo, v.rotation));
        continue;
      }
      const decision = await checkStudio(repo);
      if (!decision.ok) {
        note = decision.note;
        // A worn photo shows the whole person, so it's never used as the picture of a garment.
        if (!group.worn) v.result_url = await store(repo, await frameOriginal(photo, v.rotation));
        continue;
      }
      await repo.updateIntakeGroup(group.id, { step: `Styling the ${v.view} of ${label}` });
      // A reference that won't load shouldn't cost the piece its studio shot.
      const references = combine
        ? (await Promise.all(pickReferences(views, v).map(async (r) => ({ photo: await repo.readImage(r.photo_url).catch(() => null), rotation: r.rotation })))).flatMap((r) => (r.photo ? [{ photo: r.photo, rotation: r.rotation }] : []))
        : [];
      const { data, usd } = await restyle(photo, { rotation: v.rotation, facts: group.facts ?? group.description ?? label, view: v.view, references, worn: group.worn ? { name: label, category: group.draft.category } : undefined });
      cost += usd;
      await record(repo, "studio", usd);
      v.result_url = await store(repo, data);
      v.ai = true;
    } catch (e) {
      console.error("[intake] view failed", group.id, v.view, e);
      const wasted = (e as { usd?: number }).usd ?? 0;
      cost += wasted;
      if (wasted) await record(repo, "studio", wasted);
      v.error = reason(e);
      // Keep the real photo visible so the piece is usable while a retry is pending.
      if (!v.result_url && !group.worn) {
        const photo = await repo.readImage(v.photo_url).catch(() => null);
        if (photo) v.result_url = await store(repo, await frameOriginal(photo, v.rotation)).catch(() => null);
      }
    }
  }

  const failed = views.find((v) => v.error);
  const needsOwner = group.worn || failed || !group.draft.name || group.question || group.confidence < AUTO_ADD_CONFIDENCE;
  let itemId = group.item_id;
  let status: IntakeGroup["status"] = "review";
  if (itemId) {
    await repo.updateItem(itemId, itemPhotos(views));
    status = failed ? "review" : "added";
  } else if (!needsOwner) {
    itemId = (await addItem(repo, { ...group, views })).id;
    status = "added";
    await repo.track("piece_added", { auto: true, photos: views.length });
  }
  await repo.updateIntakeGroup(group.id, {
    status,
    views,
    item_id: itemId,
    cost_usd: cost,
    note,
    step: null,
    error: failed ? `The studio shot failed: ${failed.error}` : null,
  });
  await Promise.allSettled(stale.map((u) => repo.deleteImage(u)));
}

async function store(repo: Repo, data: Buffer) {
  return repo.uploadImage(new Blob([new Uint8Array(data)], { type: "image/webp" }), "webp");
}

function itemPhotos(views: IntakeView[]): Pick<ItemInput, "image_url" | "original_image_url" | "images"> {
  const front = views.find((v) => v.view === "front") ?? views[0];
  const images: ItemImage[] = views.flatMap((v) => (v === front || !v.result_url ? [] : [{ url: v.result_url, view: v.view === "back" ? ("back" as const) : ("detail" as const), ai: v.ai || undefined }]));
  return { image_url: front.result_url, original_image_url: front.photo_url, images };
}

export async function addItem(repo: Repo, group: Pick<IntakeGroup, "draft" | "views" | "description" | "worn">) {
  const base = { ...group.draft, description: group.description, status: "active" as const, in_laundry: false, is_favorite: false };
  if (!group.worn) return repo.createItem({ ...base, ...itemPhotos(group.views) } as ItemInput);
  // Pieces from one photo each get their own copy of it, so deleting one can't break another.
  const source = group.views[0];
  const copy = await repo
    .readImage(source.photo_url)
    .then((b) => repo.uploadImage(new Blob([new Uint8Array(b)], { type: "image/jpeg" }), "jpg"))
    .catch((e) => (console.warn("[intake] source photo not copied", e), null));
  return repo.createItem({
    ...base,
    image_url: source.result_url,
    original_image_url: null,
    images: copy ? [{ url: copy, view: "worn" as const }] : [],
    reconstructed: true,
  } as ItemInput);
}
