import { getRepo, unauthorized } from "@/lib/data";
import type { WishlistItem } from "@/lib/types";

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const [wishlist, items] = await Promise.all([repo.listWishlist(), repo.listItems({})]);
  return Response.json({ wishlist, items });
}

export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const b = (await req.json()) as Partial<WishlistItem> & { title: string };
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
