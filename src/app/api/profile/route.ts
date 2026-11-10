import { getRepo, isSupabaseConfigured, unauthorized } from "@/lib/data";
import { limitsFromEnv } from "@/lib/intake/limits";
import { PERSIST } from "@/lib/data/demo";
import { resolveAI } from "@/lib/ai/provider";
import { geocode } from "@/lib/weather";
import { z } from "zod";

const profilePatchSchema = z.object({
  display_name: z.string().max(120).nullable().optional(),
  menswear: z.enum(["menswear", "womenswear", "both"]).optional(),
  height_cm: z.number().min(80).max(250).nullable().optional(),
  weight_kg: z.number().min(25).max(400).nullable().optional(),
  build: z.string().max(120).nullable().optional(),
  skin_tone: z.string().max(80).nullable().optional(),
  sizes: z.record(z.string().max(32), z.string().max(40)).optional(),
  home_city: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  style_keywords: z.array(z.string().max(40)).max(20).optional(),
  favorite_colors: z.array(z.string().max(40)).max(20).optional(),
  avoid: z.array(z.string().max(80)).max(30).optional(),
  budget: z.enum(["low", "mid", "high"]).nullable().optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  notes: z.string().max(1000).nullable().optional(),
}).strip();

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const ai = resolveAI(repo.userId).source !== "none";
  const studio = ai ? await repo.studioShotsUsed().then((used) => ({ used, allowance: limitsFromEnv().allowance })).catch(() => null) : null;
  return Response.json({
    studio,
    profile: await repo.getProfile(),
    mode: repo.mode,
    ai,
    supabase: isSupabaseConfigured(),
    local: !isSupabaseConfigured() && PERSIST,
  });
}

export async function PATCH(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = profilePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Some profile details are invalid." }, { status: 400 });
  const patch = parsed.data;
  if (patch.home_city) {
    const g = await geocode(patch.home_city).catch(() => null);
    if (g) Object.assign(patch, { latitude: g.lat, longitude: g.lon, country: patch.country || g.country || null });
  }
  return Response.json(await repo.updateProfile(patch));
}
