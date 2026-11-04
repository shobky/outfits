import { getRepo, isSupabaseConfigured, unauthorized } from "@/lib/data";
import { geocode } from "@/lib/weather";
import type { Profile } from "@/lib/types";

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json({
    profile: await repo.getProfile(),
    mode: repo.mode,
    ai: Boolean(process.env.OPENAI_API_KEY),
    supabase: isSupabaseConfigured(),
  });
}

export async function PATCH(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const patch = (await req.json()) as Partial<Profile>;
  if (patch.home_city) {
    const g = await geocode(patch.home_city).catch(() => null);
    if (g) Object.assign(patch, { latitude: g.lat, longitude: g.lon, country: patch.country || g.country || null });
  }
  return Response.json(await repo.updateProfile(patch));
}
