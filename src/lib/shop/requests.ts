import { z } from "zod";

export const productRequest = z.object({ url: z.string().trim().url().max(2048) });
export const searchRequest = z.object({
  query: z.string().trim().min(2).max(120),
  store: z.enum(["townteam", "defacto", "amazon"]).optional(),
  maxPrice: z.number().finite().positive().max(1_000_000).optional(),
});

// Non-billable fetch protection. Bounded per-process; retailer caches also coalesce requests.
const windows = new Map<string, { until: number; count: number }>();
export function allowShopRequest(userId: string, now = Date.now()) {
  for (const [key, value] of windows) if (value.until <= now) windows.delete(key);
  const window = windows.get(userId);
  if (window && window.count >= 30) return false;
  if (!window && windows.size >= 2000) return false;
  windows.set(userId, { until: window?.until ?? now + 60_000, count: (window?.count ?? 0) + 1 });
  return true;
}
