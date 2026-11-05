import { getRepo, isSupabaseConfigured, unauthorized } from "@/lib/data";
import { limitsFromEnv } from "@/lib/intake/limits";
import { PERSIST } from "@/lib/data/demo";
import { resolveAI } from "@/lib/ai/provider";
import { geocode } from "@/lib/weather";
import type { Profile } from "@/lib/types";

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
  const patch = (await req.json()) as Partial<Profile>;
  // Only /api/dev changes these, after checking who's asking.
  delete patch.limits_off;
  delete patch.dev_features;
  if (patch.home_city) {
    const g = await geocode(patch.home_city).catch(() => null);
    if (g) Object.assign(patch, { latitude: g.lat, longitude: g.lon, country: patch.country || g.country || null });
  }
  return Response.json(await repo.updateProfile(patch));
}
