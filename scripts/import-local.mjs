#!/usr/bin/env node
/**
 * One-off: copy local-mode data (.data/store.json + .data/uploads/) into Supabase.
 *
 *   node scripts/import-local.mjs --email you@example.com            # dry run, changes nothing
 *   node scripts/import-local.mjs --email you@example.com --apply
 *
 * Add --include-samples to also import the seeded demo garments (skipped by default).
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. The user
 * must have signed in once. Safe to re-run: ids are derived from the local ids, so
 * rows and files are overwritten rather than duplicated.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const email = args[args.indexOf("--email") + 1];
const apply = flag("apply");
const includeSamples = flag("include-samples");
if (!args.includes("--email") || !email) {
  console.error("Usage: node scripts/import-local.mjs --email you@example.com [--apply] [--include-samples]");
  process.exit(1);
}

const DATA_DIR = path.resolve(".data");
const store = JSON.parse(readFileSync(path.join(DATA_DIR, "store.json"), "utf8"));
const isSample = (x) => String(x.id).startsWith("demo-");
const keep = (rows = []) => (includeSamples ? rows : rows.filter((r) => !isSample(r)));

const items = keep(store.items);
const outfits = keep(store.outfits);
const wishlist = keep(store.wishlist);
const chats = (store.chats ?? []).map(([, c]) => c);

let userId = "00000000-0000-0000-0000-000000000000"; // replaced before any write in --apply
/** Stable UUID per user + local id, which is what makes re-runs idempotent. */
const stableId = (kind, id) => {
  const h = createHash("sha1").update(`outfits:${userId}:${kind}:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const TYPES = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };
const problems = [];
let files = 0;
let sb = null;

/** Local upload → public Supabase URL. Bundled /demo/ assets and remote URLs stay as they are. */
async function moveImage(url) {
  const m = /^\/api\/files\/([0-9a-f-]{36}\.(webp|png|jpg))$/.exec(url ?? "");
  if (!m) {
    if (url?.startsWith("data:")) problems.push("An in-memory data: image was skipped");
    return url?.startsWith("data:") ? null : (url ?? null);
  }
  const file = path.join(DATA_DIR, "uploads", m[1]);
  if (!existsSync(file)) {
    problems.push(`Missing file: ${m[1]}`);
    return null;
  }
  files++;
  if (!apply) return url;
  const target = `${userId}/${m[1]}`;
  const { error } = await sb.storage.from("wardrobe").upload(target, readFileSync(file), { contentType: TYPES[m[2]], upsert: true });
  if (error) throw new Error(`Upload of ${m[1]} failed: ${error.message}`);
  return sb.storage.from("wardrobe").getPublicUrl(target).data.publicUrl;
}

async function must(label, query) {
  const { error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
}

if (apply) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Listing users failed: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No user with email ${email}. Sign in to the app once first.`);
  userId = user.id;
}

const itemRows = [];
for (const it of items) {
  const images = [];
  for (const img of it.images ?? []) {
    const moved = await moveImage(img.url);
    if (moved) images.push({ ...img, url: moved });
  }
  itemRows.push({
    ...it,
    id: stableId("item", it.id),
    user_id: userId,
    image_url: await moveImage(it.image_url),
    original_image_url: await moveImage(it.original_image_url),
    images,
  });
}

const itemIds = new Map(items.map((it) => [it.id, stableId("item", it.id)]));
const outfitRows = outfits.map((o) => ({
  ...o,
  id: stableId("outfit", o.id),
  user_id: userId,
  items: o.items.filter((i) => itemIds.has(i.item_id)).map((i) => ({ ...i, item_id: itemIds.get(i.item_id) })),
}));
const wishlistRows = wishlist.map((w) => ({
  ...w,
  id: stableId("wish", w.id),
  user_id: userId,
  pairs_with: (w.pairs_with ?? []).filter((i) => itemIds.has(i)).map((i) => itemIds.get(i)),
}));
const chatRows = chats.map((c) => ({
  id: c.session.id,
  user_id: userId,
  title: c.session.title,
  messages: c.messages,
  created_at: c.session.created_at,
  updated_at: c.session.updated_at,
}));
const profile = { ...store.profile };
delete profile.id;

console.log(`${apply ? "Importing" : "Dry run, nothing will change"} for ${email}`);
console.log(`  items     ${itemRows.length} (${store.items.length - items.length} samples skipped)`);
console.log(`  outfits   ${outfitRows.length} (${store.outfits.length - outfits.length} samples skipped)`);
console.log(`  wishlist  ${wishlistRows.length} (${store.wishlist.length - wishlist.length} samples skipped)`);
console.log(`  chats     ${chatRows.length}`);
console.log(`  image files to upload  ${files}`);
console.log("  profile   1");
const dropped = outfits.flatMap((o) => o.items).filter((i) => !itemIds.has(i.item_id)).length;
if (dropped) console.log(`  note: ${dropped} outfit slots point at skipped items and were removed`);
for (const p of problems) console.warn(`  warning: ${p}`);

if (!apply) {
  console.log("\nRe-run with --apply to write this to Supabase.");
  process.exit(0);
}

if (itemRows.length) await must("items", sb.from("items").upsert(itemRows));
if (outfitRows.length) await must("outfits", sb.from("outfits").upsert(outfitRows));
if (wishlistRows.length) await must("wishlist", sb.from("wishlist_items").upsert(wishlistRows));
if (chatRows.length) await must("chats", sb.from("chats").upsert(chatRows));
await must("profile", sb.from("profiles").update({ ...profile, updated_at: new Date().toISOString() }).eq("id", userId));
console.log("\nDone.");
