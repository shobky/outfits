import { after } from "next/server";
import { getRepo, unauthorized } from "@/lib/data";
import { resolveAI } from "@/lib/ai/provider";
import { hasFeature } from "@/lib/features";
import { MAX_PHOTOS, runBatch } from "@/lib/intake/run";
import { limitsAreOff, photoDailyLimit } from "@/lib/usage";
import { nextReset } from "@/lib/usage-rules";

export const maxDuration = 300;

export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  return Response.json(await repo.listIntake());
}

/** body: { photos: url[] } already in storage. Answers at once; the work carries on after. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const { photos, kind } = (await req.json()) as { photos?: string[]; kind?: "closet" | "worn" };
  if (!photos?.length) return Response.json({ error: "No photos were sent" }, { status: 400 });
  if (photos.length > MAX_PHOTOS) return Response.json({ error: `Up to ${MAX_PHOTOS} photos at a time` }, { status: 400 });
  if (kind === "worn") {
    if (!(await hasFeature(repo, "worn_extract"))) return Response.json({ error: "This isn't switched on for your account" }, { status: 403 });
    if (resolveAI(repo.userId).source !== "key") return Response.json({ error: "Pieces from worn photos isn't available here" }, { status: 400 });
    if (photos.length > 1) return Response.json({ error: "One photo at a time" }, { status: 400 });
  }
  // AI spend happens on the owner's key, so a runaway client can't run it up.
  if (!(await limitsAreOff(repo))) {
    const today = await repo.countIntakePhotosToday();
    if (today + photos.length > photoDailyLimit()) {
      const left = Math.max(0, photoDailyLimit() - today);
      const at = new Date(nextReset()).toUTCString().slice(17, 22);
      return Response.json({ error: left ? `You have ${left} photo${left === 1 ? "" : "s"} left today, so try fewer. More at ${at} UTC.` : `That's all your photos for today. More at ${at} UTC.` }, { status: 429 });
    }
  }
  const batch = await repo.createIntakeBatch(photos, kind === "worn" ? "worn" : "closet");
  await repo.track("batch_created", { photos: photos.length });
  after(() => runBatch(repo, batch));
  return Response.json(batch);
}
