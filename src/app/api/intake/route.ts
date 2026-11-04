import { after } from "next/server";
import { getRepo, unauthorized } from "@/lib/data";
import { dailyPhotoLimit, MAX_PHOTOS, runBatch } from "@/lib/intake/run";

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
  const { photos } = (await req.json()) as { photos?: string[] };
  if (!photos?.length) return Response.json({ error: "No photos were sent" }, { status: 400 });
  if (photos.length > MAX_PHOTOS) return Response.json({ error: `Up to ${MAX_PHOTOS} photos at a time` }, { status: 400 });
  // AI spend happens on the owner's key, so a runaway client can't run it up.
  const today = await repo.countIntakePhotosToday();
  if (today + photos.length > dailyPhotoLimit()) {
    return Response.json({ error: `You've reached today's limit of ${dailyPhotoLimit()} photos. It resets tomorrow.` }, { status: 429 });
  }
  const batch = await repo.createIntakeBatch(photos);
  after(() => runBatch(repo, batch));
  return Response.json(batch);
}
