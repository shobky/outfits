import sharp from "sharp";
import { getRepo, unauthorized } from "@/lib/data";
import { frameGarment, orient } from "@/lib/image/frame";
import { frameOriginal } from "@/lib/intake/studio";
import { photoFiles, setPhoto } from "@/lib/item-images";

type Body = { url: string; rotate?: 90 | -90; flip?: boolean; useOriginal?: boolean };

/** Rotate or mirror a photo, or go back to the real photo instead of the AI one. No AI, no cost. */
export async function POST(req: Request, ctx: RouteContext<"/api/items/[id]/transform">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const { url, rotate, flip, useOriginal } = (await req.json()) as Body;
  try {
    const [item] = await repo.getItems([id]);
    if (!item) return Response.json({ error: "Piece not found" }, { status: 404 });
    if (!photoFiles(item).includes(url)) return Response.json({ error: "That photo isn't on this piece" }, { status: 404 });

    const isFront = item.image_url === url;
    let output: Buffer;
    if (useOriginal) {
      if (!isFront || !item.original_image_url) return Response.json({ error: "No original photo to go back to" }, { status: 400 });
      output = await frameOriginal(await repo.readImage(item.original_image_url));
    } else {
      const turned = await orient(await repo.readImage(url), { rotation: rotate === -90 ? 270 : rotate, flip }).png().toBuffer();
      output = await frameGarment(await sharp(turned).toBuffer());
    }
    const next = await repo.uploadImage(new Blob([new Uint8Array(output)], { type: "image/webp" }), "webp");
    const view = isFront ? "front" : item.images.find((i) => i.url === url)?.view === "back" ? "back" : "detail";
    const { patch, removed } = setPhoto(item, { view, url: next, original_url: item.original_image_url, replaces: url });
    const updated = await repo.updateItem(id, patch);
    await Promise.allSettled(removed.map((u) => repo.deleteImage(u)));
    return Response.json(updated);
  } catch (e) {
    console.error("[transform]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
