"use client";

/** Stores an image through /api/upload. Throws with the server's reason. */
export async function uploadImage(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const body = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !body.url) throw new Error(body.error ?? `Upload failed (${r.status})`);
  return body.url;
}
