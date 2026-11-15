"use client";
import useSWR, { mutate as globalMutate } from "swr";
import type { IntakeBatch, IntakeGroup, Item, Outfit, Profile, WishlistItem } from "./types";
import { api, fetcher } from "./utils";

export function useItems(query = "status=all") {
  return useSWR<{ items: Item[]; mode: "demo" | "supabase" }>(`/api/items?${query}`, fetcher);
}

/** Serialized item patch shared by cards, sheets and chat. */
const itemPatchQueues = new Map<string, Promise<void>>();

export async function patchItem(id: string, patch: Partial<Item>) {
  const key = (k: unknown) => typeof k === "string" && k.startsWith("/api/items");
  const previous = itemPatchQueues.get(id) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    // Wait for the server before updating the cache so a failed request cannot leave
    // an optimistic value visible while the network is unavailable.
    const updated = await api<Item>(`/api/items/${id}`, "PATCH", patch);
    await globalMutate(
      key,
      (data?: { items: Item[]; mode: "demo" | "supabase" }) =>
        data && { ...data, items: data.items.map((item) => (item.id === id ? { ...item, ...updated } : item)) },
      { revalidate: false },
    );
    await globalMutate(key).catch(() => undefined);
  });
  const tracked = operation.finally(() => {
    if (itemPatchQueues.get(id) === tracked) itemPatchQueues.delete(id);
  });
  itemPatchQueues.set(id, tracked);
  return tracked;
}

export async function deleteItem(id: string) {
  await api(`/api/items/${id}`, "DELETE");
  globalMutate((k) => typeof k === "string" && k.startsWith("/api/items"));
}

/** Logs pieces as worn today, in the user's own time zone. Returns how many were newly logged. */
export async function markWorn(itemIds: string[], outfitId?: string) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { logged } = await api<{ logged: number }>("/api/wear", "POST", { item_ids: itemIds, date, outfit_id: outfitId ?? null });
  globalMutate((k) => typeof k === "string" && (k.startsWith("/api/items") || k === "/api/outfits"));
  return logged;
}

export type IntakeData = { batches: IntakeBatch[]; groups: IntakeGroup[] };

/** A piece stuck this long means its server run died, so it can be retried. */
export const STUCK_AFTER_MS = 6 * 60 * 1000;
export function isStuck(row: { updated_at: string }) {
  return Date.now() - new Date(row.updated_at).getTime() > STUCK_AFTER_MS;
}

export function useIntake(polling: boolean) {
  return useSWR<IntakeData>("/api/intake", fetcher, { refreshInterval: polling ? 2500 : 0, revalidateOnFocus: true });
}

export function useOutfits() {
  return useSWR<{ outfits: Outfit[]; items: Item[] }>("/api/outfits", fetcher);
}

export function useWishlist() {
  return useSWR<{ wishlist: WishlistItem[]; items: Item[] }>("/api/wishlist", fetcher);
}

export function useProfile() {
  return useSWR<{ profile: Profile; mode: "demo" | "supabase"; ai: boolean; supabase: boolean; local: boolean; studio: { used: number; allowance: number } | null }>("/api/profile", fetcher);
}
