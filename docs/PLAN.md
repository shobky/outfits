# Outfits — plan & roadmap

**Vision:** the feeling of opening a beautifully organised wardrobe, plus a friend with great taste who knows every piece you own. Realistic (your real clothes, real weather, real products), minimal, calm.

Status legend: ✅ done · 🟡 partial · ⬜ todo

## Phase 0 — Prototype (this commit)
- ✅ Next.js 16 + Tailwind v4 PWA shell, mobile tab bar / desktop rail, dark default + light toggle
- ✅ Data model + Supabase migration (items, outfits, wear_log, wishlist, chats, profiles, storage bucket, RLS)
- ✅ Local mode (no env needed): seeded repo persisted to `.data/` + illustrated sample garments
- ✅ Drawer: grid, category chips w/ counts, search, filters (color/season/occasion/laundry/archived), item sheet (favorite, laundry, archive, edit, delete, front/back toggle)
- ✅ Add flow: multi-photo, in-browser background removal, auto-crop/center, AI tagging (vision → structured attributes), review form, optional back photo
- ✅ Stylist chat (AI SDK v7): token streaming, collapsible agent steps drawer, header status pill, model pill, attachments, markdown + code with copy, chat history sidebar (persisted), tappable clarifying questions (`ask_user`), outfit boards, item strips, shopping suggestion cards
- ✅ Agent tools: load_skill, get_profile, update_profile, get_weather (Open-Meteo), search_wardrobe, wardrobe_stats, show_items, compose_outfit, suggest_purchases, ask_user, web_search (OpenAI)
- ✅ 7 curated stylist skills (composition, color, proportion/fit, dress codes, weather, culture, wardrobe gaps)
- ✅ Outfits tab (saved boards, favorite, delete), Shop tab (suggestions → wishlist → bought), Profile (body, sizes, city, taste)
- ✅ Supabase magic-link auth + proxy session refresh
- ⬜ **Deploy**: Supabase project + Vercel + `outfits.shobky.com` (see `docs/DEPLOY.md`)

## Phase 1 — Make it real with your own closet (next)
1. ⬜ Create Supabase project, run migration, set env on Vercel, deploy to subdomain
2. ⬜ Upload the real wardrobe; tune the cut-out pipeline on hard cases (dark items on dark bg, knits, sheer fabrics). If edges disappoint → add server provider (see RESEARCH → Background removal), keep the `removeBg()` signature
3. ⬜ Batch upload UX polish: bulk "save all" when AI confidence is high; duplicate detection
4. ⬜ "Wore this today" button on outfits → `wear_log` + `wear_count`/`last_worn_at` (schema ready) so rotation works
5. ⬜ Stylist eval set (docs/STYLIST.md) + iterate skills/prompt with real model
6. ⬜ Image `items.images` in outfit board: flip to back view on tap
7. ⬜ Error/empty/offline states pass; PWA install prompt on iOS (add-to-home hint)

## Phase 2 — Wow features
- ⬜ **Extract items from worn/Instagram photos** (user uploads photos of themselves): detect + segment garments on the person → match to existing items via image embeddings (dedupe) → new items get an optional AI-reconstructed flat shot (badge `images[].ai = true`). See RESEARCH → "Items from worn photos".
- ⬜ **Try-on**: render the outfit on the user's own full-body photo (gpt-image edit / FLUX try-on endpoint). Store user body photo in profile. Keep the flat-lay board as the "truthful" view.
- ⬜ Real product search for suggestions with images & prices (OpenAI web_search is wired; add a product-search API for structured results — RESEARCH → Shopping)
- ⬜ Calendar/trip planning: "pack for X" → capsule + checklist
- ⬜ Daily outfit push notification (web push) with weather
- ⬜ Outfit builder: manual drag-to-compose (ref: "Model" screen with category picker carousel)

## Phase 3 — Business
- ⬜ Multi-user hardening: private storage bucket + signed URLs, rate limits, usage caps per user, cost tracking
- ⬜ 3D item views (image-to-3D for rigid items first: shoes, bags, caps)
- ⬜ Affiliate links on suggestions; resale ("list it") flow
- ⬜ Replace AGPL background-removal lib before closed-source commercial launch
- ⬜ Native wrappers (Capacitor) if PWA limits bite (camera, push on iOS)

## Decisions log
- 2026-11 — Renamed to **Outfits** (repo `shobky/outfits`, subdomain `outfits.shobky.com`). Closet tab keeps the name "Drawer".
- 2026-11 — Local mode persists to disk so the app is usable with only an OpenAI key.
- 2026-11 — Demo mode first-class so UI can be built/tested without keys. Repo interface keeps demo and Supabase identical.
- 2026-11 — In-browser cut-out (free, private) over paid APIs for v0; provider is swappable.
- 2026-11 — Flat-lay outfit board (real cut-outs) over generated try-on for v0: realism > spectacle.
- 2026-11 — Front/back photos now; 3D deferred (soft garments reconstruct poorly; little UX gain vs cost).
