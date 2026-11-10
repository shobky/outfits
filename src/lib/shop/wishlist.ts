import { z } from "zod";

const webUrl = z.string().trim().url().max(2048).refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Use an HTTP or HTTPS link");
export { webUrl as shopWebUrl };
export const wishSchema = z.object({
  title: z.string().trim().min(1).max(240),
  category: z.enum(["top", "bottom", "outerwear", "onepiece", "footwear", "accessory"]).nullable().optional(),
  subcategory: z.string().max(100).nullable().optional(),
  color: z.string().max(100).nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  price: z.number().finite().nonnegative().max(100_000_000).nullable().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).nullable().optional(),
  url: webUrl.nullable().optional(),
  image_url: webUrl.nullable().optional(),
  retailer: z.string().max(160).nullable().optional(),
  reason: z.string().max(3000).nullable().optional(),
  pairs_with: z.array(z.string().max(100)).max(30).optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  status: z.enum(["idea", "saved", "bought", "dismissed"]).optional(),
});

export const wishPatchSchema = wishSchema.partial().strict();

/** Keep variant query parameters: two sizes/colours may be intentional saves. */
export function wishUrlKey(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}
