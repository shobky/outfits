import { getRepo, unauthorized, type Repo } from "@/lib/data";
import { removePhoto, setPhoto, type PhotoChange, type SetPhoto } from "@/lib/item-images";

const fail = (e: unknown) => {
  console.error("[item images]", e);
  return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
};

/** Saves the item first: a leftover file is harmless, a dangling image link isn't. */
async function commit(repo: Repo, id: string, { patch, removed }: PhotoChange) {
  const item = await repo.updateItem(id, patch);
  const results = await Promise.allSettled(removed.map((url) => repo.deleteImage(url)));
  results.forEach((r) => r.status === "rejected" && console.warn("[item images] file not removed", r.reason));
  return Response.json(item);
}

/** body: SetPhoto. The files are already uploaded through /api/upload. */
export async function POST(req: Request, ctx: RouteContext<"/api/items/[id]/images">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json()) as SetPhoto;
  try {
    const [item] = await repo.getItems([id]);
    if (!item) return Response.json({ error: "Piece not found" }, { status: 404 });
    return await commit(repo, id, setPhoto(item, body));
  } catch (e) {
    return fail(e);
  }
}

/** body: { url }. Only URLs that belong to this item can be removed. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/items/[id]/images">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const { url } = (await req.json()) as { url: string };
  try {
    const [item] = await repo.getItems([id]);
    if (!item) return Response.json({ error: "Piece not found" }, { status: 404 });
    const result = removePhoto(item, url);
    if (!result) return Response.json({ error: "That photo isn't on this piece" }, { status: 404 });
    return await commit(repo, id, result);
  } catch (e) {
    return fail(e);
  }
}
