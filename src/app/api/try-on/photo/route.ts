import { getRepo, unauthorized } from "@/lib/data";

/** The person's own photo for try-on. body: { url } of a file they already uploaded. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url) return Response.json({ error: "No photo was sent" }, { status: 400 });
  try {
    await repo.readImage(url); // refuses anything that isn't theirs
    const old = (await repo.getProfile()).try_on_photo_url;
    await repo.updateProfile({ try_on_photo_url: url });
    if (old && old !== url) await repo.deleteImage(old).catch((e) => console.warn("[try-on] not removed", e));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const old = (await repo.getProfile()).try_on_photo_url;
  await repo.updateProfile({ try_on_photo_url: null });
  if (old) await repo.deleteImage(old).catch((e) => console.warn("[try-on] not removed", e));
  return Response.json({ ok: true });
}
