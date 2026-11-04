import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { UPLOAD_DIR } from "@/lib/data/demo";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

/** Serves images uploaded in local mode from `.data/uploads/`. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[name]">) {
  await connection();
  const { name } = await ctx.params;
  const m = /^[0-9a-f-]{36}\.(webp|png|jpg)$/.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(new Uint8Array(buf), { headers: { "content-type": TYPES[m[1]], "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
