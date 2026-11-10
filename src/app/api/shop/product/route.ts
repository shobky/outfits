import { getRepo, unauthorized } from "@/lib/data";
import { allowShopRequest, productRequest } from "@/lib/shop/requests";
import { getShopProduct } from "@/lib/shop/service";

export const maxDuration = 30;
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = productRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid product link." }, { status: 400 });
  if (!allowShopRequest(repo.userId)) return Response.json({ error: "Too many shop requests. Try again in a minute." }, { status: 429 });
  return Response.json(await getShopProduct(parsed.data.url));
}
