import { withTryOnLease } from "@/lib/intake/tryon-lock";
import { getRepo, unauthorized } from "@/lib/data";
import type { Profile, TryOnPhoto } from "@/lib/types";
import { z } from "zod";

const kinds = ["full_body", "face", "side"] as const;
const bodySchema = z.object({ url: z.string().min(1).max(2048), kind: z.enum(kinds).optional() }).strict();
const kindSchema = z.object({ kind: z.enum(kinds).optional() }).strict();

function storedPhotos(profile: Profile): TryOnPhoto[] {
  return (Array.isArray(profile.try_on_photos) ? profile.try_on_photos : []).filter(
    (photo): photo is TryOnPhoto => Boolean(photo && typeof photo.url === "string" && photo.url.length <= 2048 && kinds.includes(photo.kind) && typeof photo.created_at === "string"),
  );
}

/** The person's own photo for try-on. body: { url } of a file they already uploaded. */
export async function POST(req: Request) { return withTryOnLease(() => post(req)); }
async function post(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send a photo and choose full body, face, or side." }, { status: 400 });
  const { url, kind = "full_body" } = parsed.data;
  if (!/^\/api\/try-on\/file\/reference\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(url)) return Response.json({ error: "Upload a private reference photo first." }, { status: 400 });
  try {
    const storedUrl = url;
    await repo.readPrivateImage(url);
    const profile = await repo.getProfile();
    const now = new Date().toISOString();
    const existing = storedPhotos(profile);
    const old = existing.find((photo) => photo.kind === kind && photo.url !== storedUrl)?.url ?? (kind === "full_body" ? profile.try_on_photo_url : null);
    if (existing.some((photo) => photo.url === storedUrl && photo.kind !== kind)) return Response.json({ error: "Use a separate photo for each reference view." }, { status: 400 });
    const photos = existing.filter((photo) => photo.kind !== kind || photo.url === storedUrl);
    const next = [...photos.filter((photo) => photo.url !== storedUrl), { url: storedUrl, kind, created_at: now }];
    const patch: Partial<Profile> = { try_on_photos: next, try_on_insights: null };
    if (kind === "full_body") patch.try_on_photo_url = storedUrl;
    await repo.updateProfile(patch);
    if (old && old !== storedUrl && !next.some((photo) => photo.url === old)) {
      const remove = old.includes("/api/try-on/file/") ? repo.deletePrivateImage(old) : repo.deleteImage(old);
      await remove.catch((e) => console.warn("[try-on] not removed", e));
    }
    return Response.json({ ok: true, photo: { url: storedUrl, kind, created_at: now }, profile: await repo.getProfile() });
  } catch (e) {
    console.error("[try-on/photo]", e);
    return Response.json({ error: "We couldn't save that reference photo. Try again." }, { status: 400 });
  }
}

export async function DELETE(req: Request) { return withTryOnLease(() => remove(req)); }
async function remove(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = kindSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Choose a valid reference type." }, { status: 400 });
  const profile = await repo.getProfile();
  const photos = storedPhotos(profile);
  const removed = parsed.data.kind ? photos.filter((photo) => photo.kind === parsed.data.kind) : photos;
  const keep = parsed.data.kind ? photos.filter((photo) => photo.kind !== parsed.data.kind) : [];
  const nextPrimary = keep.find((photo) => photo.kind === "full_body")?.url ?? (parsed.data.kind && parsed.data.kind !== "full_body" ? profile.try_on_photo_url ?? null : null);
  const legacy = profile.try_on_photo_url && !photos.some((photo) => photo.url === profile.try_on_photo_url) ? profile.try_on_photo_url : null;
  await repo.updateProfile({ try_on_photos: keep, try_on_photo_url: nextPrimary, try_on_insights: null });
  for (const photo of [...removed, ...(legacy && legacy !== nextPrimary ? [{ url: legacy } as TryOnPhoto] : [])]) {
    if (!keep.some((other) => other.url === photo.url)) {
      const remove = photo.url.includes("/api/try-on/file/") ? repo.deletePrivateImage(photo.url) : repo.deleteImage(photo.url);
      await remove.catch((e) => console.warn("[try-on] not removed", e));
    }
  }
  return Response.json({ ok: true, profile: await repo.getProfile() });
}
