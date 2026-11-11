import { getRepo } from "@/lib/data";
import { shopWebUrl } from "@/lib/shop/wishlist";
import sharp from "sharp";

const MAX_FILE_BYTES = 4.4 * 1024 * 1024;
const MAX_FILES = 4;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const MAX_NORMALIZED_BYTES = 4.4 * 1024 * 1024;

function textValue(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) || null : null;
}

function firstUrl(...values: (string | null)[]) {
  const candidate = values.find((value) => value && shopWebUrl.safeParse(value).success) ?? null;
  if (candidate) return candidate;
  const match = values.find(Boolean)?.match(/https?:\/\/[^\s<>]+/i)?.[0]?.replace(/[),.;]+$/, "");
  return match && shopWebUrl.safeParse(match).success ? match : null;
}

/** Web Share Target handoff. It stores a short-lived owner-scoped intent; nothing is added to the Drawer or wishlist until the user chooses an action. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return Response.json({ error: "Sign in before sharing to Outfits." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "That share could not be read." }, { status: 400 });

  const title = textValue(form.get("title"), 240);
  const text = textValue(form.get("text"), 4000);
  const url = firstUrl(textValue(form.get("url"), 2048), text);
  const entries = form.getAll("files").filter((value): value is File => value instanceof Blob && value.size > 0);
  if (entries.length > MAX_FILES) return Response.json({ error: `Please share up to ${MAX_FILES} photos at a time.` }, { status: 413 });
  if (entries.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return Response.json({ error: "Share a JPEG, PNG, or WebP image." }, { status: 415 });
  if (entries.some((file) => file.size > MAX_FILE_BYTES) || entries.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "Those photos are too large. Share smaller images (up to 4.4MB each)." }, { status: 413 });
  }
  if (!entries.length && !url && !text && !title) return Response.json({ error: "Share a photo or product link to get started." }, { status: 400 });

  const photos: string[] = [];
  try {
    for (const file of entries) {
      const source = Buffer.from(await file.arrayBuffer());
      const image = sharp(source, { failOn: "error" });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw new Error("image_dimensions_not_supported");
      const normalized = await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
      if (normalized.byteLength > MAX_NORMALIZED_BYTES) throw new Error("image_bytes_not_supported");
      photos.push(await repo.uploadPrivateImage(new Blob([new Uint8Array(normalized)], { type: "image/webp" }), "webp", "reference"));
    }
    const intent = await repo.createShareIntent({ title, text, url, photos });
    await repo.track("share_received", { photos: photos.length, link: Boolean(url) });
    const location = `/share?id=${encodeURIComponent(intent.id)}`;
    if (req.headers.get("accept")?.includes("application/json")) return Response.json({ id: intent.id, location });
    return Response.redirect(new URL(location, req.url), 303);
  } catch (error) {
    await Promise.all(photos.map((photo) => (photo.startsWith("/api/try-on/file/") ? repo.deletePrivateImage(photo) : repo.deleteImage(photo)).catch(() => {})));
    console.error("[share target]", error);
    return Response.json({ error: "We couldn't receive that share. Please try again." }, { status: 502 });
  }
}
