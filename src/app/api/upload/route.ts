import { getRepo, unauthorized } from "@/lib/data";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { limitsAreOff } from "@/lib/usage";

/** Vercel rejects request bodies over 4.5MB before this handler runs, so fail clearly below that. */
const MAX_BYTES = 4.4 * 1024 * 1024;

/** multipart: file=<Blob>. Returns { url }. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const form = await req.formData().catch(() => null);
  if (!(await limitsAreOff(repo)) && !(await rateLimit("upload", 20, 600))) return rateLimited();
  const file = form?.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "No file was received" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That image is over the 4.4MB limit" }, { status: 413 });
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return Response.json({ error: "Only PNG, JPEG or WebP images are accepted" }, { status: 415 });
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  try {
    return Response.json({ url: await repo.uploadImage(file, ext) });
  } catch (e) {
    console.error("[upload]", e);
    return Response.json({ error: `Storage rejected the image: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
