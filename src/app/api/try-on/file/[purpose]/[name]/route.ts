import { getRepo } from "@/lib/data";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/** Authenticated proxy for private try-on references and previews. */
export async function GET(_req: Request, ctx: { params: Promise<{ purpose: string; name: string }> }) {
  const repo = await getRepo();
  if (!repo) return new Response("Unauthorized", { status: 401 });
  const { purpose, name } = await ctx.params;
  if (!(purpose === "reference" || purpose === "result") || !/^[0-9a-f-]{36}\.(?:webp|png|jpg)$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    // The repo resolves this path inside the authenticated owner's private
    // storage folder. References also belong to shares and intake batches,
    // so membership in the body profile is not an authorization boundary.
    const image = await repo.readPrivateImage(`/api/try-on/file/${purpose}/${name}`);
    const ext = name.slice(name.lastIndexOf(".") + 1);
    return new Response(new Uint8Array(image), {
      headers: { "content-type": TYPES[ext], "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
