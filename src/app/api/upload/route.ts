import { getRepo, unauthorized } from "@/lib/data";

/** multipart: file=<Blob>. Returns { url }. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return Response.json({ error: "file required" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "max 8MB" }, { status: 413 });
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  return Response.json({ url: await repo.uploadImage(file, ext) });
}
