import { getRepo, unauthorized } from "@/lib/data";
import { garmentDimensionsSchema } from "@/lib/garment-dimensions";
import { photoGeometry } from "@/lib/image/geometry";
import type { ItemFilters, ItemInput } from "@/lib/types";

export async function GET(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const sp = new URL(req.url).searchParams;
  const filters: ItemFilters = {
    category: (sp.get("category") as ItemFilters["category"]) || undefined,
    color: sp.get("color") || undefined,
    season: (sp.get("season") as ItemFilters["season"]) || undefined,
    occasion: (sp.get("occasion") as ItemFilters["occasion"]) || undefined,
    favorite: sp.get("favorite") === "1" || undefined,
    status: (sp.get("status") as ItemFilters["status"]) || "active",
    q: sp.get("q") || undefined,
  };
  return Response.json({ items: await repo.listItems(filters), mode: repo.mode });
}

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const input = (await req.json()) as ItemInput;
  if (input.garment_dimensions !== undefined) {
    const dimensions = garmentDimensionsSchema.safeParse(input.garment_dimensions);
    if (!dimensions.success) return Response.json({ error: "Use positive garment measurements in centimetres (up to 400)." }, { status: 400 });
    input.garment_dimensions = dimensions.data;
  }
  input.photo_geometry = await photoGeometry(repo, input.image_url);
  try {
    return Response.json(await repo.createItem(input));
  } catch (e) {
    console.error("[items]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
