import { getRepo } from "@/lib/data";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/**
 * Authenticated proxy for wardrobe photos. The bucket is private; every read
 * goes through here so only the owner (or a developer) can open a photo.
 * Mirrors /api/try-on/file.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/wardrobe/[name]">) {
  // Auth runs first, on every request including cache revalidations: a photo
  // is served only while the caller's session is valid.
  const repo = await getRepo();
  if (!repo) return new Response("Unauthorized", { status: 401 });
  const { name } = await ctx.params;
  if (!/^[0-9a-f-]{36}\.(webp|png|jpg)$/.test(name)) return new Response("Not found", { status: 404 });
  // Ownership is verified before any 304: a revalidation must not confirm a
  // photo this account doesn't own. Content is uuid-addressed and immutable,
  // so owned revalidations answer 304 without a storage download; no-cache
  // means the browser always asks first.
  const etag = `"${name}"`;
  if (!(await repo.ownsImage(`/api/wardrobe/${name}`))) return new Response("Not found", { status: 404 });
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });
  try {
    const image = await repo.readImage(`/api/wardrobe/${name}`);
    const ext = name.slice(name.lastIndexOf(".") + 1);
    return new Response(new Uint8Array(image), {
      headers: { "content-type": TYPES[ext], "cache-control": "private, no-cache", etag, "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
