import { getRepo, unauthorized } from "@/lib/data";

/** Permanently removes the signed-in user, their data and their files. */
export async function DELETE() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  try {
    await repo.deleteAccount();
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[account]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
