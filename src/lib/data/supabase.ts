import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { AdminOverview, ChatSession, IntakeBatch, IntakeGroup, Item, Outfit, Profile, WishlistItem } from "../types";
import { startOfDay } from "../usage-rules";
import { filterItems, wearPatch } from "./filters";
import type { Repo } from "./repo";

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function supabaseRepo(sb: SupabaseClient, userId: string, email: string | null = null): Repo {
  return {
    mode: "supabase",
    userId,
    email,

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

    async logWear(itemIds, date, outfitId) {
      const items = must(await sb.from("items").select("*").in("id", itemIds)) as Item[];
      const fresh = items.flatMap((i) => {
        const patch = wearPatch(i, date);
        return patch ? [{ id: i.id, patch }] : [];
      });
      if (!fresh.length) return 0;
      must(await sb.from("wear_log").insert({ item_ids: fresh.map((f) => f.id), worn_on: date, outfit_id: outfitId }));
      for (const f of fresh) must(await sb.from("items").update(f.patch).eq("id", f.id));
      return fresh.length;
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
    async deleteImage(url) {
      const marker = "/storage/v1/object/public/wardrobe/";
      const at = url.indexOf(marker);
      if (at < 0) return;
      const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
      if (!path.startsWith(`${userId}/`)) return;
      const { error } = await sb.storage.from("wardrobe").remove([path]);
      if (error) throw new Error(error.message);
    },
    async readImage(url) {
      const marker = "/storage/v1/object/public/wardrobe/";
      const at = url.indexOf(marker);
      const path = at < 0 ? "" : decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
      if (!path.startsWith(`${userId}/`)) throw new Error("That photo isn't yours");
      const { data, error } = await sb.storage.from("wardrobe").download(path);
      if (error) throw new Error(error.message);
      return Buffer.from(await data.arrayBuffer());
    },
    async createUploadTarget(ext) {
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await sb.storage.from("wardrobe").createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      return { method: "PUT", url: data.signedUrl, publicUrl: sb.storage.from("wardrobe").getPublicUrl(path).data.publicUrl };
    },

    async aiSpendToday() {
      return Number(must(await sb.rpc("ai_spend_today"))) || 0;
    },
    async studioShotsUsed() {
      const { count, error } = await sb.from("ai_spend").select("id", { count: "exact", head: true }).eq("kind", "studio");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async tryOnsToday() {
      const { count, error } = await sb.from("ai_spend").select("id", { count: "exact", head: true }).eq("kind", "try_on").gte("created_at", startOfDay());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async adminOverview() {
      return must(await sb.rpc("admin_overview")) as Omit<AdminOverview, "flags">;
    },
    async adminSetFeatures(person, features) {
      must(await sb.rpc("admin_set_features", { person, wanted: features }));
    },
    async adminCreateInvite(code, note, maxUses) {
      must(await sb.rpc("admin_create_invite", { new_code: code, new_note: note, uses: maxUses }));
    },
    async adminRevokeInvite(code) {
      must(await sb.rpc("admin_revoke_invite", { old_code: code }));
    },
    async memberFeatures() {
      const row = must(await sb.from("member_features").select("features").eq("user_id", userId).maybeSingle()) as { features: string[] } | null;
      return row?.features ?? [];
    },
    async chatMessagesToday() {
      return Number(must(await sb.rpc("chat_messages_today"))) || 0;
    },
    async recordAiSpend(kind, usd) {
      must(await sb.rpc("record_ai_spend", { spend_kind: kind, spend_usd: usd }));
    },
    async track(name, props) {
      const { error } = await sb.from("events").insert({ name, props: props ?? {} });
      if (error) console.warn("[events]", error.message);
    },
    async deleteAccount() {
      // Files first: once the account is gone, nothing could remove them.
      for (;;) {
        const { data, error } = await sb.storage.from("wardrobe").list(userId, { limit: 100 });
        if (error) throw new Error(error.message);
        if (!data.length) break;
        const removal = await sb.storage.from("wardrobe").remove(data.map((f) => `${userId}/${f.name}`));
        if (removal.error) throw new Error(removal.error.message);
        if (!removal.data?.length) throw new Error("Your photos couldn't be removed, so your account wasn't deleted");
      }
      must(await sb.rpc("delete_my_account"));
    },

    async listIntake() {
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const batches = must(await sb.from("intake_batches").select("*").gte("created_at", since).order("created_at", { ascending: false })) as IntakeBatch[];
      const groups = must(await sb.from("intake_groups").select("*").gte("created_at", since).neq("status", "dismissed").order("created_at", { ascending: false })) as IntakeGroup[];
      return { batches, groups };
    },
    async countIntakePhotosToday() {
      const rows = must(await sb.from("intake_batches").select("photos").gte("created_at", startOfDay())) as { photos: string[] }[];
      return rows.reduce((n, r) => n + r.photos.length, 0);
    },
    async createIntakeBatch(photos, kind = "closet") {
      return must(await sb.from("intake_batches").insert({ photos, kind }).select().single()) as IntakeBatch;
    },
    async updateIntakeBatch(id, patch) {
      must(await sb.from("intake_batches").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
    },
    async createIntakeGroups(groups) {
      if (!groups.length) return [];
      return must(await sb.from("intake_groups").insert(groups).select()) as IntakeGroup[];
    },
    async getIntakeGroup(id) {
      return must(await sb.from("intake_groups").select("*").eq("id", id).maybeSingle()) as IntakeGroup | null;
    },
    async updateIntakeGroup(id, patch) {
      must(await sb.from("intake_groups").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
    },
  };
}
