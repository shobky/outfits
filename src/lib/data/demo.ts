import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
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
/**
 * Local mode persists to `.data/` (gitignored) so your closet survives restarts
 * on your machine. Disabled on Vercel (read-only FS) or with LOCAL_PERSIST=0.
 */
export const PERSIST = !process.env.VERCEL && process.env.LOCAL_PERSIST !== "0";
export const DATA_DIR = path.join(process.cwd(), ".data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const STORE_FILE = path.join(DATA_DIR, "store.json");

type Persisted = Omit<Store, "chats"> & { chats: [string, { session: ChatSession; messages: UIMessage[] }][] };

function load(): Store | null {
  if (!PERSIST || !existsSync(STORE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Persisted;
    return { ...raw, items: raw.items.map((i) => ({ ...i, images: i.images ?? [] })), chats: new Map(raw.chats) };
  } catch (e) {
    console.error("[outfits] could not read .data/store.json — starting fresh", e);
    return null;
  }
}

function save() {
  if (!PERSIST) return;
  const s = store();
  mkdirSync(DATA_DIR, { recursive: true });
  const data: Persisted = { ...s, chats: [...s.chats.entries()] };
  writeFileSync(STORE_FILE, JSON.stringify(data, null, 1));
}

const g = globalThis as unknown as { __outfitsStore?: Store };
function store(): Store {
  g.__outfitsStore ??= load() ?? {
    items: process.env.DEMO_SEED === "0" ? [] : seedItems(),
    outfits: process.env.DEMO_SEED === "0" ? [] : seedOutfits(),
    wishlist: process.env.DEMO_SEED === "0" ? [] : seedWishlist(),
    profile: seedProfile(),
    chats: new Map(),
  };
  return g.__outfitsStore;
}

const uid = () => crypto.randomUUID();
const ts = () => new Date().toISOString();

function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new Error("Not found");
  list[i] = { ...list[i], ...patch, id };
  return list[i];
}

const repo: Repo = {
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

  async uploadImage(data, ext) {
    const buf = Buffer.from(await data.arrayBuffer());
    if (!PERSIST) return `data:${data.type || "image/webp"};base64,${buf.toString("base64")}`;
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return `/api/files/${name}`;
  },
};

/** Wrap every mutating method so it writes the store to disk afterwards. */
const MUTATING = ["createItem", "updateItem", "deleteItem", "createOutfit", "updateOutfit", "deleteOutfit", "createWishlist", "updateWishlist", "deleteWishlist", "updateProfile", "saveChat", "deleteChat"] as const;
for (const k of MUTATING) {
  const fn = repo[k] as (...a: unknown[]) => Promise<unknown>;
  (repo as unknown as Record<string, unknown>)[k] = async (...args: unknown[]) => {
    const r = await fn(...args);
    save();
    return r;
  };
}

export const demoRepo = repo;
