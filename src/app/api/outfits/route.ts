import { getRepo, unauthorized } from "@/lib/data";
import type { Outfit } from "@/lib/types";

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const [outfits, items] = await Promise.all([repo.listOutfits(), repo.listItems({ status: "all" })]);
  return Response.json({ outfits, items });
}

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const body = (await req.json()) as Omit<Outfit, "id" | "user_id" | "created_at">;
  return Response.json(
    await repo.createOutfit({
      name: body.name,
      occasion: body.occasion ?? null,
      notes: body.notes ?? null,
      source: body.source ?? "user",
      is_favorite: body.is_favorite ?? false,
      weather: body.weather ?? null,
      items: body.items,
    }),
  );
}
