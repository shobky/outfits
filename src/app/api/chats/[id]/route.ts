import { getRepo, unauthorized } from "@/lib/data";

export async function GET(_req: Request, ctx: RouteContext<"/api/chats/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const chat = await repo.getChat(id);
  return Response.json(chat ?? { session: null, messages: [] });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/chats/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  await repo.deleteChat(id);
  return Response.json({ ok: true });
}
