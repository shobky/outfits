import { getRepo, unauthorized } from "@/lib/data";

/** body: { item_ids, date: "YYYY-MM-DD" in the user's own time zone, outfit_id? } */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { item_ids, date, outfit_id } = (await req.json()) as { item_ids?: string[]; date?: string; outfit_id?: string | null };
  if (!item_ids?.length || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "item_ids and date are required" }, { status: 400 });
  }
  try {
    return Response.json({ logged: await repo.logWear(item_ids, date, outfit_id ?? null) });
  } catch (e) {
    console.error("[wear]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
