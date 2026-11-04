import { getRepo, unauthorized } from "@/lib/data";

/** Retires a failed batch once the owner has retried it, so it stops showing. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/intake/batches/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  await repo.updateIntakeBatch(id, { status: "done", error: null });
  return Response.json({ ok: true });
}
