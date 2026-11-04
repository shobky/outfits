"use client";

async function sendOnce(blob: Blob): Promise<string> {
  const t = await fetch("/api/upload/target", { method: "POST" });
  const target = (await t.json().catch(() => ({}))) as { method?: "PUT" | "FORM"; url?: string; publicUrl?: string | null; error?: string };
  if (!t.ok || !target.url) throw new Error(target.error ?? `Upload failed (${t.status})`);
  if (target.method === "PUT") {
    const r = await fetch(target.url, { method: "PUT", headers: { "content-type": blob.type || "image/jpeg" }, body: blob });
    if (!r.ok) throw new Error(`Storage rejected the photo (${r.status})`);
    return target.publicUrl!;
  }
  const fd = new FormData();
  fd.append("file", blob);
  const r = await fetch(target.url, { method: "POST", body: fd });
  const body = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !body.url) throw new Error(body.error ?? `Upload failed (${r.status})`);
  return body.url;
}

/** Stores a photo, retrying once because phone connections drop. Throws with the reason. */
export async function uploadImage(blob: Blob): Promise<string> {
  try {
    return await sendOnce(blob);
  } catch {
    return sendOnce(blob);
  }
}
