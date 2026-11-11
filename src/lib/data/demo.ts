import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { UIMessage } from "ai";
import type { AiSpendKind, ChatSession, IntakeBatch, IntakeGroup, Item, Outfit, Profile, WishlistItem } from "../types";
import { startOfDay } from "../usage-rules";
import { filterItems, wearPatch } from "./filters";
import { DEMO_USER_ID, seedItems, seedOutfits, seedProfile, seedWishlist } from "./demo-seed";
import type { Repo } from "./repo";

/** In-memory store (survives hot reloads via globalThis; resets on server restart). */
interface Store {
  tryOnRuns?: import("../types").TryOnRun[];
  shareIntents?: import("../types").ShareIntent[];
  pushSubscriptions?: import("../types").PushSubscriptionRecord[];
  items: Item[];
  outfits: Outfit[];
  wishlist: WishlistItem[];
  profile: Profile;
  chats: Map<string, { session: ChatSession; messages: UIMessage[] }>;
  intakeBatches: IntakeBatch[];
  intakeGroups: IntakeGroup[];
  aiSpend: { kind: AiSpendKind; usd: number; at: string }[];
  invites: { code: string; note: string | null; max_uses: number; used_count: number; created_at: string }[];
}
/**
 * Local mode persists to `.data/` (gitignored) so your closet survives restarts
 * on your machine. Disabled on Vercel (read-only FS) or with LOCAL_PERSIST=0.
 */
export const PERSIST = !process.env.VERCEL && process.env.LOCAL_PERSIST !== "0";
export const DATA_DIR = path.join(process.cwd(), ".data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const PRIVATE_UPLOAD_DIR = path.join(DATA_DIR, "try-on");
const STORE_FILE = path.join(DATA_DIR, "store.json");

type Persisted = Omit<Store, "chats"> & { chats: [string, { session: ChatSession; messages: UIMessage[] }][] };

function load(): Store | null {
  if (!PERSIST || !existsSync(STORE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf8")) as Persisted;
    return { ...raw, invites: raw.invites ?? [], intakeBatches: raw.intakeBatches ?? [], intakeGroups: raw.intakeGroups ?? [], aiSpend: raw.aiSpend ?? [], shareIntents: raw.shareIntents ?? [], pushSubscriptions: raw.pushSubscriptions ?? [], items: raw.items.map((i) => ({ ...i, images: i.images ?? [] })), chats: new Map(raw.chats) };
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
const privateImages = (globalThis as unknown as { __outfitsPrivateImages?: Map<string, Buffer> }).__outfitsPrivateImages ??= new Map<string, Buffer>();
function store(): Store {
  g.__outfitsStore ??= load() ?? {
    items: process.env.DEMO_SEED === "0" ? [] : seedItems(),
    outfits: process.env.DEMO_SEED === "0" ? [] : seedOutfits(),
    wishlist: process.env.DEMO_SEED === "0" ? [] : seedWishlist(),
    profile: seedProfile(),
    chats: new Map(),
    intakeBatches: [],
    intakeGroups: [],
    aiSpend: [],
    invites: [],
    shareIntents: [],
    pushSubscriptions: [],
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
  async listTryOnRuns() { return store().tryOnRuns ?? []; },
  async getTryOnRun(id) { return (store().tryOnRuns ?? []).find((run) => run.id === id) ?? null; },
  async saveTryOnRun(input) {
    const run = { ...input, id: uid(), user_id: DEMO_USER_ID, created_at: ts() };
    (store().tryOnRuns ??= []).unshift(run);
    save();
    return run;
  },
  async deleteTryOnRun(id) { store().tryOnRuns = (store().tryOnRuns ?? []).filter((run) => run.id !== id); save(); },
  async acquireTryOnLease(token) {
    const state = globalThis as typeof globalThis & { __tryOnLease?: { token: string; expires: number } };
    if (state.__tryOnLease && state.__tryOnLease.expires > Date.now()) return false;
    state.__tryOnLease = { token, expires: Date.now() + 240_000 };
    return true;
  },
  async releaseTryOnLease(token) {
    const state = globalThis as typeof globalThis & { __tryOnLease?: { token: string; expires: number } };
    if (state.__tryOnLease?.token === token) delete state.__tryOnLease;
  },
  mode: "demo",
  userId: DEMO_USER_ID,
  email: null,

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

  async logWear(itemIds, date) {
    let logged = 0;
    for (const item of store().items.filter((i) => itemIds.includes(i.id))) {
      const patch = wearPatch(item, date);
      if (!patch) continue;
      Object.assign(item, patch);
      logged++;
    }
    return logged;
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
  async createShareIntent(input) {
    const now = Date.now();
    const intent = { ...input, id: uid(), user_id: DEMO_USER_ID, created_at: new Date(now).toISOString(), expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString() };
    (store().shareIntents ??= []).unshift(intent);
    save();
    return intent;
  },
  async getShareIntent(id) {
    const intent = (store().shareIntents ?? []).find((entry) => entry.id === id) ?? null;
    if (!intent || intent.expires_at <= ts()) return null;
    return intent;
  },
  async deleteShareIntent(id) {
    store().shareIntents = (store().shareIntents ?? []).filter((entry) => entry.id !== id);
    save();
  },
  async listPushSubscriptions() { return store().pushSubscriptions ?? []; },
  async savePushSubscription(input) {
    const rows = (store().pushSubscriptions ??= []);
    const current = rows.find((entry) => entry.endpoint === input.endpoint);
    if (current) Object.assign(current, { ...input, updated_at: ts() });
    else rows.unshift({ ...input, id: uid(), user_id: DEMO_USER_ID, created_at: ts(), updated_at: ts() });
    save();
  },
  async deletePushSubscription(endpoint) {
    store().pushSubscriptions = (store().pushSubscriptions ?? []).filter((entry) => entry.endpoint !== endpoint);
    save();
  },

  async uploadImage(data, ext) {
    const buf = Buffer.from(await data.arrayBuffer());
    if (!PERSIST) return `data:${data.type || "image/webp"};base64,${buf.toString("base64")}`;
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return `/api/files/${name}`;
  },
  async uploadPrivateImage(data, ext, purpose = "reference") {
    const buf = Buffer.from(await data.arrayBuffer());
    const name = `${crypto.randomUUID()}.${ext}`;
    if (PERSIST) {
      const dir = path.join(PRIVATE_UPLOAD_DIR, purpose);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, name), buf);
    } else {
      privateImages.set(`${purpose}/${name}`, buf);
    }
    return `/api/try-on/file/${purpose}/${name}`;
  },
  async deletePrivateImage(url) {
    const m = /\/api\/try-on\/file\/(?:(reference|result)\/)?([0-9a-f-]{36}\.(?:webp|png|jpg))$/.exec(url);
    if (!m) return;
    const key = m[1] ? `${m[1]}/${m[2]}` : m[2];
    privateImages.delete(key);
    if (PERSIST) rmSync(path.join(PRIVATE_UPLOAD_DIR, ...(m[1] ? [m[1], m[2]] : [m[2]])), { force: true });
  },
  async readPrivateImage(url) {
    const m = /\/api\/try-on\/file\/(?:(reference|result)\/)?([0-9a-f-]{36}\.(?:webp|png|jpg))$/.exec(url);
    if (!m) throw new Error("That try-on photo isn't yours");
    const key = m[1] ? `${m[1]}/${m[2]}` : m[2];
    if (!PERSIST) {
      const image = privateImages.get(key);
      if (!image) throw new Error("That try-on photo isn't yours");
      return image;
    }
    return readFileSync(path.join(PRIVATE_UPLOAD_DIR, ...(m[1] ? [m[1], m[2]] : [m[2]])));
  },
  async deleteImage(url) {
    if (url.startsWith("/api/try-on/file/")) return repo.deletePrivateImage(url);
    const m = /^\/api\/files\/([0-9a-f-]{36}\.(?:webp|png|jpg))$/.exec(url);
    if (m) rmSync(path.join(UPLOAD_DIR, m[1]), { force: true });
  },
  async readImage(url) {
    if (url.startsWith("/api/try-on/file/")) return repo.readPrivateImage(url);
      const sample = /^\/demo\/([a-z0-9-]+\.svg)$/.exec(url);
      if (sample) return readFileSync(path.join(process.cwd(), "public", "demo", sample[1]));
    const data = /^data:[^;]+;base64,(.+)$/.exec(url);
    if (data) return Buffer.from(data[1], "base64");
    const m = /^\/api\/files\/([0-9a-f-]{36}\.(?:webp|png|jpg))$/.exec(url);
    if (!m) throw new Error("That photo isn't yours");
    return readFileSync(path.join(UPLOAD_DIR, m[1]));
  },
  async createUploadTarget() {
    return { method: "FORM", url: "/api/upload", publicUrl: null };
  },

  async aiSpendToday() {
    const today = ts().slice(0, 10);
    return store().aiSpend.filter((s) => s.at.startsWith(today)).reduce((n, s) => n + s.usd, 0);
  },
  async studioShotsUsed() {
    return store().aiSpend.filter((s) => s.kind === "studio").length;
  },
  async tryOnsToday() {
    const today = ts().slice(0, 10);
    return store().aiSpend.filter((s) => s.kind === "try_on" && s.at.startsWith(today)).length;
  },
  async adminOverview() {
    const s = store();
    return {
      people: [{ id: DEMO_USER_ID, email: "you@this-computer", joined: ts(), last_seen: ts(), pieces: s.items.length, spend_total: s.aiSpend.reduce((n, x) => n + x.usd, 0), spend_today: 0, features: s.profile.dev_features ?? [], invite_code: null, member: true }],
      invites: s.invites,
      spend: [...new Set(s.aiSpend.map((x) => x.kind))].map((kind) => {
        const rows = s.aiSpend.filter((x) => x.kind === kind);
        const total = rows.reduce((n, x) => n + x.usd, 0);
        return { kind, today: total, week: total, total, calls: rows.length };
      }),
      health: { users: 1, median_pieces: s.items.length, shop_taps: 0, old_enough: 0, back_in_week_2: 0 },
    };
  },
  async adminSetFeatures(_person, features) {
    store().profile = { ...store().profile, dev_features: features };
  },
  async adminCreateInvite(code, note, maxUses) {
    const upper = code.trim().toUpperCase();
    if (store().invites.some((i) => i.code === upper)) throw new Error("That code already exists");
    store().invites.unshift({ code: upper, note, max_uses: Math.max(1, maxUses), used_count: 0, created_at: ts() });
  },
  async adminRevokeInvite(code) {
    store().invites = store().invites.filter((i) => i.code !== code);
  },
  async memberFeatures() {
    return []; // Local mode is a developer, whose features live on the profile.
  },
  async chatMessagesToday() {
    return 0; // Local mode only ever runs one person, usually on the free demo stylist.
  },
  async recordAiSpend(kind, usd) {
    store().aiSpend.push({ kind, usd, at: ts() });
  },
  async track() {
    // Nothing to measure on one person's own machine.
  },
  async deleteAccount() {
    throw new Error("There's no account to delete in local mode");
  },

  async listIntake() {
    const newestFirst = <T extends { created_at: string }>(rows: T[]) => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { batches: newestFirst(store().intakeBatches), groups: newestFirst(store().intakeGroups.filter((g) => g.status !== "dismissed")) };
  },
  async countIntakePhotosToday() {
    const since = startOfDay();
    return store().intakeBatches.filter((b) => b.created_at >= since).reduce((n, b) => n + b.photos.length, 0);
  },
  async createIntakeBatch(photos, kind = "closet") {
    const batch: IntakeBatch = { id: uid(), user_id: DEMO_USER_ID, photos, kind, matched: [], status: "analyzing", error: null, rejected: [], cost_usd: 0, created_at: ts(), updated_at: ts() };
    store().intakeBatches.unshift(batch);
    return batch;
  },
  async updateIntakeBatch(id, patch) {
    patchIn(store().intakeBatches, id, { ...patch, updated_at: ts() });
  },
  async createIntakeGroups(groups) {
    const rows = groups.map((g): IntakeGroup => ({ ...g, id: uid(), user_id: DEMO_USER_ID, created_at: ts(), updated_at: ts() }));
    store().intakeGroups.push(...rows);
    return rows;
  },
  async getIntakeGroup(id) {
    return store().intakeGroups.find((g) => g.id === id) ?? null;
  },
  async updateIntakeGroup(id, patch) {
    patchIn(store().intakeGroups, id, { ...patch, updated_at: ts() });
  },
};

/** Wrap every mutating method so it writes the store to disk afterwards. */
const MUTATING = ["adminSetFeatures", "adminCreateInvite", "adminRevokeInvite", "recordAiSpend", "createIntakeBatch", "updateIntakeBatch", "createIntakeGroups", "updateIntakeGroup", "createItem", "updateItem", "deleteItem", "logWear", "createOutfit", "updateOutfit", "deleteOutfit", "createWishlist", "updateWishlist", "deleteWishlist", "updateProfile", "saveChat", "deleteChat"] as const;
for (const k of MUTATING) {
  const fn = repo[k] as (...a: unknown[]) => Promise<unknown>;
  (repo as unknown as Record<string, unknown>)[k] = async (...args: unknown[]) => {
    const r = await fn(...args);
    save();
    return r;
  };
}

export const demoRepo = repo;
