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
- 🟡 **Deploy**: Supabase and Vercel are set up (see `docs/DEPLOY.md`). Sign-in, the domain and iPhone checks are listed under Phase 1

## Phase 1 — Make it real with your own closet (next)
1. 🟡 Supabase project, migrations, auth URLs, Vercel project and env vars are done. Still to verify on the live site: sign-in through the Supabase repo, iPhone upload over HTTPS, home-screen install
   - ⬜ Custom SMTP, so sign-in reaches the home-screen app (see `docs/DEPLOY.md` → Email limits)
2. 🟡 Add flow rebuilt: up to 8 photos at once, processed on the server in the background. AI groups photos by garment, fixes rotation, makes consistent studio shots, fills in details, and auto-adds confident pieces. Everything else waits for review with a retry. Rotate, mirror and "use my photo" on every item. See RESEARCH → Photo → studio shot. ⬜ Upload the real wardrobe and tune the prompt on hard cases on hard cases (dark items on dark bg, knits, sheer fabrics). If edges disappoint → add server provider (see RESEARCH → Background removal), keep the `removeBg()` signature
3. ⬜ Batch upload UX polish: bulk "save all" when AI confidence is high; duplicate detection
4. ✅ "Wore it today" on chat and saved outfits → `wear_log` + `wear_count`/`last_worn_at`, counted once per day
5. 🟡 Chat components done against the Demo stylist: weather card, tappable swaps, side-by-side outfits, product cards that read image and price from the retailer's page. ⬜ Run the eval set (docs/STYLIST.md) on the real model and improve skills/prompt. Not run yet: owner declined the spend for now
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
- ⬜ 3D item views from front/back photos. Not started: owner chose not to fund the comparison yet. See "3D options" below
- ⬜ Affiliate links on suggestions; resale ("list it") flow
- ⬜ Replace AGPL background-removal lib before closed-source commercial launch
- ⬜ Native wrappers (Capacitor) if PWA limits bite (camera, push on iOS)

## 3D options (prices checked 2026-11, compare on real garments before choosing)
| Option | Cost per model | Notes |
|---|---|---|
| Tripo multiview | 30 credits textured; $0.01/credit on fal, so about $0.30 | Takes multi-angle photos |
| Hunyuan3D v2 multi-view (fal) | $0.16 listed; textured is 3x, so about $0.48 | Also **requires a left-side photo** |
| TRELLIS multi-image (fal) | Not listed (single-image is $0.02) | Takes any list of images |
| Meshy multi-image | 30 credits textured | Prepaid, no published USD rate |

Suggested trial: 3 garments on Tripo + TRELLIS with a fal.ai key, budget $3.

## Decisions log
- 2026-11 — Beta foundations live: invites (off until `INVITE_ONLY=1`), spending limits, usage events, account deletion. Stylist limited to 20 messages a day. Profile has a developer menu for addresses in `ALLOWED_EMAILS`.
- 2026-11 — Premium order, chosen by the owner: `multi_photo` (live, off by default), then `worn_extract`, then `try_on`, all behind flags (`docs/PREMIUM.md`).
- 2026-11 — Measured on the API key: about $0.029 per photo, about $0.019 per stylist message with one web search ($0.0094 tokens, one sample).
- 2026-11 — In-browser cut-out replaced by server-side AI studio shots, at the owner's request, about $0.03 per photo. The real photo is always kept.
- 2026-11 — Auto-add confident pieces rather than review everything, chosen by the owner. Threshold: 0.75.
- 2026-11 — Going live: `ALLOWED_EMAILS` gates the app, because open sign-in would spend on the owner's API keys.
- 2026-11 — Local `.data/` held only sample data, so nothing was imported to Supabase. `scripts/import-local.mjs` stays for later.
- 2026-11 — Renamed to **Outfits** (repo `shobky/outfits`, subdomain `outfits.shobky.com`). Closet tab keeps the name "Drawer".
- 2026-11 — Local mode persists to disk so the app is usable with only an OpenAI key.
- 2026-11 — Demo mode first-class so UI can be built/tested without keys. Repo interface keeps demo and Supabase identical.
- 2026-11 — In-browser cut-out (free, private) over paid APIs for v0; provider is swappable.
- 2026-11 — Flat-lay outfit board (real cut-outs) over generated try-on for v0: realism > spectacle.
- 2026-11 — Front/back photos now; 3D deferred (soft garments reconstruct poorly; little UX gain vs cost).
