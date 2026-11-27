import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { getRepo, unauthorized } from "@/lib/data";
import { photoGeometry } from "@/lib/image/geometry";
import { isPrivateIp } from "@/lib/shop/service";
import { CATEGORIES, COLORS, FITS, MATERIALS, OCCASIONS, PATTERNS, SEASONS, type Category } from "@/lib/taxonomy";
import type { ItemInput } from "@/lib/types";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;

const colorNames = Object.keys(COLORS) as string[];

const importItem = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(Object.keys(CATEGORIES) as [Category, ...Category[]]),
  subcategory: z.string().max(40).optional(),
  colors: z.array(z.string()).max(4).optional(),
  pattern: z.string().optional(),
  material: z.string().optional(),
  fit: z.string().optional(),
  seasons: z.array(z.string()).max(4).optional(),
  occasions: z.array(z.string()).max(6).optional(),
  formality: z.number().int().min(1).max(5).optional(),
  warmth: z.number().int().min(1).max(5).optional(),
  brand: z.string().max(60).optional(),
  size: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(300).optional(),
  image_url: z.string().url().max(500).optional(),
  measurements: z
    .object({
      width_cm: z.number().positive().max(400).nullable().optional(),
      length_cm: z.number().positive().max(400).nullable().optional(),
    })
    .optional(),
  measurement_notes: z.string().max(200).optional(),
});

const bodySchema = z.object({
  /** Producer tag, recorded in item notes as [catalog:<source>]. */
  source: z.string().min(2).max(24).regex(/^[a-z0-9-]+$/).default("wornby"),
  items: z.array(importItem).min(1).max(50),
});

function pick<T extends string>(values: readonly T[], value: string | undefined): T | null {
  return value && (values as readonly string[]).includes(value) ? (value as T) : null;
}

/** Fetches a catalog image over https after refusing private-address hosts, so an import URL can't reach the internal network. */
async function fetchCatalogImage(raw: string): Promise<{ data: Buffer; ext: "jpg" | "png" | "webp" } | null> {
  try {
    let url = new URL(raw);
    for (let hop = 0; hop <= 2; hop++) {
      if (url.protocol !== "https:") return null;
      const host = url.hostname.toLowerCase();
      if (isIP(host)) return null;
      const addresses = await lookup(host, { all: true }).catch(() => []);
      if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
      try {
        const res = await fetch(url, { redirect: "manual", signal: controller.signal });
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location) return null;
          url = new URL(location, url);
          continue;
        }
        if (!res.ok) return null;
        const type = (res.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
        const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : null;
        if (!ext) return null;
        const data = Buffer.from(await res.arrayBuffer());
        if (data.length === 0 || data.length > MAX_IMAGE_BYTES) return null;
        return { data, ext };
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** body: { source?, items: [...] } — bulk-imports catalog pieces (e.g. wornby.ai cutouts) with known attributes, no AI analysis. */
export async function POST(req: Request) {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { source?, items: [1..50] } with a name and a valid category per item." }, { status: 400 });
  const { source, items } = parsed.data;

  const created: string[] = [];
  const warnings: string[] = [];
  for (const item of items) {
    try {
      let imageUrl: string | null = null;
      if (item.image_url) {
        if (await repo.ownsImage(item.image_url)) {
          imageUrl = item.image_url;
        } else {
          const fetched = await fetchCatalogImage(item.image_url);
          if (fetched) imageUrl = await repo.uploadImage(new Blob([new Uint8Array(fetched.data)]), fetched.ext);
          else warnings.push(`${item.name}: image couldn't be fetched, saved without a photo`);
        }
      }
      const description = [item.description, item.measurement_notes ? `Measurements: ${item.measurement_notes}` : null].filter(Boolean).join("\n") || null;
      const input: ItemInput = {
        name: item.name,
        category: item.category,
        subcategory: pick(CATEGORIES[item.category], item.subcategory) ?? CATEGORIES[item.category][0],
        colors: (item.colors ?? []).filter((c) => colorNames.includes(c)) as ItemInput["colors"],
        pattern: pick(PATTERNS, item.pattern) ?? "solid",
        material: pick(MATERIALS, item.material),
        fit: pick(FITS, item.fit),
        seasons: (item.seasons ?? []).filter((s) => (SEASONS as readonly string[]).includes(s)) as ItemInput["seasons"],
        occasions: (item.occasions ?? []).filter((o) => (OCCASIONS as readonly string[]).includes(o)) as ItemInput["occasions"],
        formality: item.formality ?? 3,
        warmth: item.warmth ?? 3,
        brand: item.brand ?? null,
        size: item.size ?? null,
        image_url: imageUrl,
        original_image_url: null,
        images: [],
        description,
        notes: [`[catalog:${source}]`, item.notes].filter(Boolean).join(" "),
        status: "active",
        in_laundry: false,
        is_favorite: false,
        garment_dimensions:
          item.measurements && (item.measurements.width_cm || item.measurements.length_cm)
            ? { width_cm: item.measurements.width_cm ?? null, length_cm: item.measurements.length_cm ?? null, source: "catalog" }
            : null,
      };
      input.photo_geometry = await photoGeometry(repo, input.image_url);
      const saved = await repo.createItem(input);
      created.push(saved.id);
    } catch (error) {
      warnings.push(`${item.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return Response.json({ created: created.length, ids: created, warnings });
}
