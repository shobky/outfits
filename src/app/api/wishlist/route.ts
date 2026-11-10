import { getRepo, unauthorized } from "@/lib/data";
import type { WishlistItem } from "@/lib/types";
import { wishSchema, wishUrlKey } from "@/lib/shop/wishlist";

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const [wishlist, items] = await Promise.all([repo.listWishlist(), repo.listItems({})]);
  return Response.json({ wishlist, items });
}

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = wishSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the title, links, price and currency." }, { status: 400 });
  const b = parsed.data as Partial<WishlistItem> & { title: string };
  if (b.price != null && !b.currency) return Response.json({ error: "Choose a currency for this price." }, { status: 400 });
  if (b.url) {
    const existing = (await repo.listWishlist()).find((w) => w.url && wishUrlKey(w.url) === wishUrlKey(b.url!) && w.title === b.title);
    if (existing) {
      if (existing.status === "idea" && (b.status ?? "saved") === "saved") return Response.json(await repo.updateWishlist(existing.id, { status: "saved" }));
      return Response.json(existing);
    }
  }
  const [created] = await repo.createWishlist([
    {
      title: b.title,
      category: b.category ?? null,
      subcategory: b.subcategory ?? null,
      color: b.color ?? null,
      brand: b.brand ?? null,
      price: b.price ?? null,
      currency: b.currency ?? null,
      url: b.url ?? null,
      image_url: b.image_url ?? null,
      retailer: b.retailer ?? null,
      reason: b.reason ?? null,
      pairs_with: b.pairs_with ?? [],
      priority: b.priority ?? 2,
      status: b.status ?? "saved",
      source: "user",
    },
  ]);
  return Response.json(created);
}
