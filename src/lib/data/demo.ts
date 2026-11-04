import type { UIMessage } from "ai";
import type { ChatSession, Item, Outfit, Profile, WishlistItem } from "../types";
import { filterItems } from "./filters";
import { DEMO_USER_ID, seedItems, seedOutfits, seedProfile, seedWishlist } from "./demo-seed";
import type { Repo } from "./repo";

/** In-memory store (survives hot reloads via globalThis; resets on server restart). */
interface Store {
  items: Item[];
  outfits: Outfit[];
  wishlist: WishlistItem[];
  profile: Profile;
  chats: Map<string, { session: ChatSession; messages: UIMessage[] }>;
}
const g = globalThis as unknown as { __drawerDemo?: Store };
function store(): Store {
  g.__drawerDemo ??= {
    items: seedItems(),
    outfits: seedOutfits(),
    wishlist: seedWishlist(),
    profile: seedProfile(),
    chats: new Map(),
  };
  return g.__drawerDemo;
}

const uid = () => crypto.randomUUID();
const ts = () => new Date().toISOString();

function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new Error("Not found");
  list[i] = { ...list[i], ...patch, id };
  return list[i];
}

export const demoRepo: Repo = {
  mode: "demo",
  userId: DEMO_USER_ID,

  async listItems(f) {
    return filterItems(store().items, f);
  },
  async getItems(ids) {
    return store().items.filter((i) => ids.includes(i.id));
  },
  async createItem(input) {
    const item: Item = { wear_count: 0, last_worn_at: null, ...input, id: uid(), user_id: DEMO_USER_ID, created_at: ts() };
    store().items.unshift(item);
    return item;
  },
  async updateItem(id, patch) {
    return patchIn(store().items, id, patch as Partial<Item>);
  },
  async deleteItem(id) {
    store().items = store().items.filter((i) => i.id !== id);
  },

  async listOutfits() {
    return [...store().outfits].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async createOutfit(input) {
    const o: Outfit = { ...input, id: uid(), user_id: DEMO_USER_ID, created_at: ts() };
    store().outfits.unshift(o);
    return o;
  },
  async updateOutfit(id, patch) {
    return patchIn(store().outfits, id, patch);
  },
  async deleteOutfit(id) {
    store().outfits = store().outfits.filter((o) => o.id !== id);
  },

  async listWishlist() {
    return store().wishlist.filter((w) => w.status !== "dismissed");
  },
  async createWishlist(items) {
    const created = items.map((w) => ({ ...w, id: uid(), user_id: DEMO_USER_ID, created_at: ts() }));
    store().wishlist.unshift(...created);
    return created;
  },
  async updateWishlist(id, patch) {
    return patchIn(store().wishlist, id, patch);
  },
  async deleteWishlist(id) {
    store().wishlist = store().wishlist.filter((w) => w.id !== id);
  },

  async getProfile() {
    return store().profile;
  },
  async updateProfile(patch) {
    store().profile = { ...store().profile, ...patch, id: DEMO_USER_ID };
    return store().profile;
  },

  async listChats() {
    return [...store().chats.values()].map((c) => c.session).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async getChat(id) {
    return store().chats.get(id) ?? null;
  },
  async saveChat(id, messages, title) {
    const existing = store().chats.get(id);
    const session: ChatSession = existing
      ? { ...existing.session, updated_at: ts(), title: title ?? existing.session.title }
      : { id, user_id: DEMO_USER_ID, title: title ?? "New chat", created_at: ts(), updated_at: ts() };
    store().chats.set(id, { session, messages });
  },
  async deleteChat(id) {
    store().chats.delete(id);
  },

  async uploadImage(data) {
    // Demo mode: keep the image inline as a data URL.
    const buf = Buffer.from(await data.arrayBuffer());
    return `data:${data.type || "image/webp"};base64,${buf.toString("base64")}`;
  },
};
