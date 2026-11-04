import { getRepo, unauthorized } from "@/lib/data";

export async function PATCH(req: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  return Response.json(await repo.updateOutfit(id, await req.json()));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  await repo.deleteOutfit(id);
  return Response.json({ ok: true });
}
