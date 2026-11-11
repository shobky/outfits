import { getRepo, unauthorized } from "@/lib/data";
import { photoFiles } from "@/lib/item-images";
import { garmentDimensionsSchema } from "@/lib/garment-dimensions";

export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const patch = await req.json();
  if (patch.garment_dimensions !== undefined) {
    const dimensions = garmentDimensionsSchema.safeParse(patch.garment_dimensions);
    if (!dimensions.success) return Response.json({ error: "Use positive garment measurements in centimetres (up to 400)." }, { status: 400 });
    patch.garment_dimensions = dimensions.data;
  }
  delete patch.photo_geometry;
  return Response.json(await repo.updateItem(id, patch));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const [item] = await repo.getItems([id]);
  await repo.deleteItem(id);
  if (item) {
    const results = await Promise.allSettled([...new Set(photoFiles(item))].map((url) => repo.deleteImage(url)));
    results.forEach((r) => r.status === "rejected" && console.warn("[items] file not removed", r.reason));
  }
  return Response.json({ ok: true });
}
