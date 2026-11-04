import { getRepo, unauthorized } from "@/lib/data";

/** Vercel rejects request bodies over 4.5MB before this handler runs, so fail clearly below that. */
const MAX_BYTES = 4.4 * 1024 * 1024;

/** multipart: file=<Blob>. Returns { url }. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "No file was received" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That image is over the 4.4MB limit" }, { status: 413 });
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  try {
    return Response.json({ url: await repo.uploadImage(file, ext) });
  } catch (e) {
    console.error("[upload]", e);
    return Response.json({ error: `Storage rejected the image: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
