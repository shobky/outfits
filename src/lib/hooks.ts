"use client";
import useSWR, { mutate as globalMutate } from "swr";
import type { Item, Outfit, Profile, WishlistItem } from "./types";
import { api, fetcher } from "./utils";

export function useItems(query = "status=all") {
  return useSWR<{ items: Item[]; mode: "demo" | "supabase" }>(`/api/items?${query}`, fetcher);
}

/** Optimistic item patch shared by cards, sheets and chat. */
export async function patchItem(id: string, patch: Partial<Item>) {
  const key = (k: unknown) => typeof k === "string" && k.startsWith("/api/items");
  await globalMutate(
    key,
    (data?: { items: Item[]; mode: "demo" | "supabase" }) =>
      data && { ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
    { revalidate: false },
  );
  await api(`/api/items/${id}`, "PATCH", patch);
  globalMutate(key);
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

export function useOutfits() {
  return useSWR<{ outfits: Outfit[]; items: Item[] }>("/api/outfits", fetcher);
}

export function useWishlist() {
  return useSWR<{ wishlist: WishlistItem[]; items: Item[] }>("/api/wishlist", fetcher);
}

export function useProfile() {
  return useSWR<{ profile: Profile; mode: "demo" | "supabase"; ai: boolean; supabase: boolean; local: boolean }>("/api/profile", fetcher);
}
