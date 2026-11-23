import { getRepo } from "@/lib/data";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/**
 * Authenticated proxy for wardrobe photos. The bucket is private; every read
 * goes through here so only the owner (or a developer) can open a photo.
 * Mirrors /api/try-on/file.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/wardrobe/[name]">) {
  const repo = await getRepo();
  if (!repo) return new Response("Unauthorized", { status: 401 });
  const { name } = await ctx.params;
  if (!/^[0-9a-f-]{36}\.(webp|png|jpg)$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const image = await repo.readImage(`/api/wardrobe/${name}`);
    const ext = name.slice(name.lastIndexOf(".") + 1);
    return new Response(new Uint8Array(image), {
      // Photos are content-addressed by uuid, so a long cache is safe; auth is
      // re-checked on every request because the route is dynamic.
      headers: { "content-type": TYPES[ext], "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
