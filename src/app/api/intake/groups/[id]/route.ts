import { after } from "next/server";
import { getRepo, unauthorized } from "@/lib/data";
import { addItem, runGroup } from "@/lib/intake/run";
import type { IntakeGroup } from "@/lib/types";

export const maxDuration = 300;

type Body = { action: "retry" | "approve" | "dismiss" | "split" | "clear"; draft?: IntakeGroup["draft"] };

/** The owner's decisions on one piece. */
export async function POST(req: Request, ctx: RouteContext<"/api/intake/groups/[id]">) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { id } = await ctx.params;
  const { action, draft } = (await req.json()) as Body;
  const group = await repo.getIntakeGroup(id);
  if (!group) return Response.json({ error: "Piece not found" }, { status: 404 });
  const current = draft ? { ...group, draft } : group;

  try {
    switch (action) {
      case "retry":
        await repo.updateIntakeGroup(id, { status: "processing", step: "Trying again", error: null, draft: current.draft });
        after(() => runGroup(repo, current));
        return Response.json({ ok: true });
      case "approve": {
        if (!current.draft.name?.trim()) return Response.json({ error: "Give it a name first" }, { status: 400 });
        const item = current.item_id ? await repo.updateItem(current.item_id, current.draft) : await addItem(repo, current);
        await repo.updateIntakeGroup(id, { status: "added", item_id: item.id, draft: current.draft, question: null });
        if (!current.item_id) await repo.track("piece_added", { auto: false, photos: current.views.length });
        return Response.json({ ok: true, item_id: item.id });
      }
      case "split": {
        // The AI grouped photos of different garments, so each extra photo becomes its own piece.
        const [first, ...rest] = current.views;
        if (!rest.length) return Response.json({ error: "This piece has only one photo" }, { status: 400 });
        await repo.createIntakeGroups(
          rest.map((v) => ({
            batch_id: current.batch_id,
            status: "review" as const,
            step: null,
            views: [{ ...v, view: "front" as const }],
            draft: { ...current.draft, name: "" },
            description: null,
            facts: null,
            confidence: 0,
            question: null,
            note: null,
            error: null,
            item_id: null,
            cost_usd: 0,
          })),
        );
        await repo.updateIntakeGroup(id, { views: [{ ...first, view: "front" }], question: null });
        return Response.json({ ok: true });
      }
      case "dismiss":
      case "clear":
        await repo.updateIntakeGroup(id, { status: "dismissed" });
        return Response.json({ ok: true });
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[intake group]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
