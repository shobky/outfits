import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { ChatSession, Item, Outfit, Profile, WishlistItem } from "../types";
import { filterItems } from "./filters";
import type { Repo } from "./repo";

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function supabaseRepo(sb: SupabaseClient, userId: string): Repo {
  return {
    mode: "supabase",
    userId,

    // Closets are small (<1–2k rows) so we fetch and filter in memory —
    // keeps demo + real behavior identical. Push filters to SQL if this grows.
    async listItems(f) {
      const rows = must(await sb.from("items").select("*").order("created_at", { ascending: false }));
      return filterItems(rows as Item[], f);
    },
    async getItems(ids) {
      if (!ids.length) return [];
      return must(await sb.from("items").select("*").in("id", ids)) as Item[];
    },
    async createItem(input) {
      return must(await sb.from("items").insert(input).select().single()) as Item;
    },
    async updateItem(id, patch) {
      return must(await sb.from("items").update(patch).eq("id", id).select().single()) as Item;
    },
    async deleteItem(id) {
      must(await sb.from("items").delete().eq("id", id));
    },

    async listOutfits() {
      return must(await sb.from("outfits").select("*").order("created_at", { ascending: false })) as Outfit[];
    },
    async createOutfit(input) {
      return must(await sb.from("outfits").insert(input).select().single()) as Outfit;
    },
    async updateOutfit(id, patch) {
      return must(await sb.from("outfits").update(patch).eq("id", id).select().single()) as Outfit;
    },
    async deleteOutfit(id) {
      must(await sb.from("outfits").delete().eq("id", id));
    },

    async listWishlist() {
      return must(
        await sb.from("wishlist_items").select("*").neq("status", "dismissed").order("created_at", { ascending: false }),
      ) as WishlistItem[];
    },
    async createWishlist(items) {
      return must(await sb.from("wishlist_items").insert(items).select()) as WishlistItem[];
    },
    async updateWishlist(id, patch) {
      return must(await sb.from("wishlist_items").update(patch).eq("id", id).select().single()) as WishlistItem;
    },
    async deleteWishlist(id) {
      must(await sb.from("wishlist_items").delete().eq("id", id));
    },

    async getProfile() {
      const row = must(await sb.from("profiles").select("*").eq("id", userId).maybeSingle());
      if (row) return row as Profile;
      return must(await sb.from("profiles").insert({ id: userId }).select().single()) as Profile;
    },
    async updateProfile(patch) {
      const { id: _ignore, ...rest } = patch;
      void _ignore;
      return must(
        await sb.from("profiles").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", userId).select().single(),
      ) as Profile;
    },

    async listChats() {
      return must(
        await sb.from("chats").select("id,user_id,title,created_at,updated_at").order("updated_at", { ascending: false }).limit(50),
      ) as ChatSession[];
    },
    async getChat(id) {
      const row = must(await sb.from("chats").select("*").eq("id", id).maybeSingle()) as
        | (ChatSession & { messages: UIMessage[] })
        | null;
      if (!row) return null;
      const { messages, ...session } = row;
      return { session, messages };
    },
    async saveChat(id, messages, title) {
      const row: Record<string, unknown> = { id, user_id: userId, messages, updated_at: new Date().toISOString() };
      if (title) row.title = title;
      must(await sb.from("chats").upsert(row));
    },
    async deleteChat(id) {
      must(await sb.from("chats").delete().eq("id", id));
    },

    async uploadImage(data, ext) {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("wardrobe").upload(path, data, {
        contentType: data.type || `image/${ext}`,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      return sb.storage.from("wardrobe").getPublicUrl(path).data.publicUrl;
    },
  };
}
