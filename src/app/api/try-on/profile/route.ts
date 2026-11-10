import { withTryOnLease } from "@/lib/intake/tryon-lock";
import { getRepo, unauthorized } from "@/lib/data";
import { hasFeature } from "@/lib/features";
import { resolveAI } from "@/lib/ai/provider";
import { analyzeTryOnProfile } from "@/lib/intake/profile";
import { limitsAreOff } from "@/lib/usage";
import { limitsFromEnv } from "@/lib/intake/limits";
import { record } from "@/lib/intake/budget";
import type { Profile, TryOnInsights, TryOnPhoto, TryOnPhotoKind } from "@/lib/types";
import { z } from "zod";

export const maxDuration = 120;

const kinds = ["full_body", "face", "side"] as const;
const requestSchema = z.discriminatedUnion("action", [z.object({ action: z.literal("analyze") }).strict(), z.object({
  action: z.literal("save"),
  insights: z.object({
    shoulders: z.enum(["narrow", "balanced", "broad"]).nullable(),
    torso: z.enum(["short", "balanced", "long"]).nullable(),
    leg_line: z.enum(["short", "balanced", "long"]).nullable(),
    silhouette: z.enum(["slim", "balanced", "broad"]).nullable(),
    posture: z.enum(["relaxed", "upright", "dynamic"]).nullable(),
    fit_notes: z.string().max(280),
    confidence: z.number().min(0).max(1),
    source_photo_urls: z.array(z.string().min(1).max(2048)).max(3),
  }).strict(),
}).strict()]);

function photosForProfile(profile: Profile) {
  return (Array.isArray(profile.try_on_photos) ? profile.try_on_photos : []).filter(
    (photo): photo is TryOnPhoto => Boolean(photo && typeof photo.url === "string" && kinds.includes(photo.kind as TryOnPhotoKind)),
  );
}

async function readProfileImage(repo: NonNullable<Awaited<ReturnType<typeof getRepo>>>, url: string) {
  try {
    return await repo.readPrivateImage(url);
  } catch {
    return repo.readImage(url);
  }
}

function cleanNotes(value: string) {
  return value
    .replace(/\b\d+(?:\.\d+)?\s*(?:cm|mm|kg|lb|lbs|ft|in|inches)?\b/gi, "")
    .replace(/\b(?:height|weight|skin\s*tone|age|ethnicity|race|gender)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

/** Analyze references without saving; explicit save is a separate action. */
export async function POST(req: Request) { return withTryOnLease(() => post(req)); }
async function post(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (!(await hasFeature(repo, "try_on"))) return Response.json({ error: "Try-on isn't switched on for your account" }, { status: 403 });
  const raw = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw && typeof raw === "object" && !Array.isArray(raw) && !Object.hasOwn(raw as object, "action") ? { action: "analyze" } : raw);
  if (!parsed.success) return Response.json({ error: "Choose a profile action." }, { status: 400 });
  const profile = await repo.getProfile();

  if (parsed.data.action === "save") {
    const current = photosForProfile(profile).map((photo) => photo.url);
    const source = [...new Set(parsed.data.insights.source_photo_urls)];
    if (!source.length || source.length !== current.length || source.some((url) => !current.includes(url))) return Response.json({ error: "Those suggestions are out of date. Analyze your current photos again." }, { status: 409 });
    const insights: TryOnInsights = {
      ...parsed.data.insights,
      fit_notes: cleanNotes(parsed.data.insights.fit_notes) || "Preserve the person's natural pose and the way fabric falls on their body.",
      source_photo_urls: source,
      generated_at: new Date().toISOString(),
    };
    return Response.json(await repo.updateProfile({ try_on_insights: insights }));
  }

  const photos = photosForProfile(profile);
  const full = photos.find((photo) => photo.kind === "full_body") ?? (profile.try_on_photo_url ? { url: profile.try_on_photo_url, kind: "full_body" as const, created_at: "" } : null);
  if (!full) return Response.json({ error: "Add a full-body photo before mapping your proportions.", code: "needs_photo" }, { status: 400 });
  const selected = [full, ...photos.filter((photo) => photo.url !== full.url && (photo.kind === "face" || photo.kind === "side"))].slice(0, 3);
  if (!(await limitsAreOff(repo)) && (await repo.aiSpendToday()) >= limitsFromEnv().dailyBudget) return Response.json({ error: "Profile mapping is resting until tomorrow." }, { status: 429 });
  const ai = resolveAI(repo.userId);
  if (ai.source === "none") return Response.json({ error: "Profile mapping needs an AI connection." }, { status: 400 });
  try {
    const withData = await Promise.all(selected.map(async (photo) => ({ ...photo, data: await readProfileImage(repo, photo.url) })));
    const { insights, usd } = await analyzeTryOnProfile(withData, ai);
    await record(repo, "vision", usd);
    // Deliberately return suggestions only. The owner must review and save them.
    return Response.json({ insights, saved: false });
  } catch (e) {
    console.error("[try-on/profile]", e);
    return Response.json({ error: "We couldn't map those photos. Try clearer, well-lit references." }, { status: 502 });
  }
}
