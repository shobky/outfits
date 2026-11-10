import { getRepo, unauthorized } from "@/lib/data";
import sharp from "sharp";

const MAX_BYTES = 4.4 * 1024 * 1024;

/** Uploads a private profile reference photo. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "No file was received" }, { status: 400 });
  if (!file.type.startsWith("image/") || !file.size) return Response.json({ error: "Choose a non-empty image file" }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That image is over the 4.4MB limit" }, { status: 413 });
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 25_000_000) return Response.json({ error: "That image is too large. Try a smaller photo." }, { status: 413 });
    const normalized = await image.autoOrient().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    return Response.json({ url: await repo.uploadPrivateImage(new Blob([new Uint8Array(normalized)], { type: "image/jpeg" }), "jpg", "reference") });
  } catch (e) {
    console.error("[try-on/upload]", e);
    return Response.json({ error: "We couldn't save that reference photo. Try again." }, { status: 502 });
  }
}
