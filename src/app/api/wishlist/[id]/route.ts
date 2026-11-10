import { getRepo, unauthorized } from "@/lib/data";
import { wishPatchSchema } from "@/lib/shop/wishlist";

export async function PATCH(req: Request, ctx: RouteContext<"/api/wishlist/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const parsed = wishPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return Response.json({ error: "Invalid wishlist change." }, { status: 400 });
  const existing = (await repo.listWishlist()).find((w) => w.id === id);
  // Dismissed rows remain editable for undo, but repository ownership still scopes the update.
  const price = parsed.data.price !== undefined ? parsed.data.price : existing?.price;
  const currency = parsed.data.currency !== undefined ? parsed.data.currency : existing?.currency;
  if (price != null && !currency) return Response.json({ error: "Choose a currency for this price." }, { status: 400 });
  return Response.json(await repo.updateWishlist(id, parsed.data));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/wishlist/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  await repo.deleteWishlist(id);
  return Response.json({ ok: true });
}
