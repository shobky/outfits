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

export function useOutfits() {
  return useSWR<{ outfits: Outfit[]; items: Item[] }>("/api/outfits", fetcher);
}

export function useWishlist() {
  return useSWR<{ wishlist: WishlistItem[]; items: Item[] }>("/api/wishlist", fetcher);
}

export function useProfile() {
  return useSWR<{ profile: Profile; mode: "demo" | "supabase"; ai: boolean; supabase: boolean; local: boolean }>("/api/profile", fetcher);
}
