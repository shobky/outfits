import { getRepo, unauthorized } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await params;
  const intent = await repo.getShareIntent(id);
  if (!intent) return Response.json({ error: "That share has expired." }, { status: 404 });
  return Response.json(intent, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await params;
  const intent = await repo.getShareIntent(id);
  if (intent) {
    await repo.deleteShareIntent(id);
    // Photos are source inputs for an intake batch or chat attachment. Keep
    // them when an explicit action has handed work to either flow; discard is
    // the only action that removes them immediately.
    if (new URL(req.url).searchParams.get("keepPhotos") !== "1") await Promise.all(intent.photos.map((photo) => (photo.startsWith("/api/try-on/file/") ? repo.deletePrivateImage(photo) : repo.deleteImage(photo)).catch(() => {})));
  }
  return Response.json({ ok: true });
}
