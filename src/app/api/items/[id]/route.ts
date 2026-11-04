import { getRepo, unauthorized } from "@/lib/data";
import { photoFiles } from "@/lib/item-images";

export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  return Response.json(await repo.updateItem(id, await req.json()));
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
