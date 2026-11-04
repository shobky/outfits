# Handoff — next session (local machine)

Read `AGENTS.md` and `docs/PLAN.md` first. Work in small commits; run `pnpm lint && npx tsc --noEmit && pnpm build` and the `verify-ui` skill before calling anything done. Ask the owner before anything that costs money or touches DNS.

## 1. Supabase
- Create/link the project (Supabase CLI or dashboard), apply `supabase/migrations/0001_init.sql`, confirm the `wardrobe` storage bucket + policies exist.
- Auth → URL config: site `https://outfits.shobky.com`, redirects `https://outfits.shobky.com/auth/callback` and `http://localhost:3000/auth/callback`.
- Fill `.env.local`, sign in via magic link, verify every tab reads/writes through `supabaseRepo`.
- Add a one-off script to import local-mode data (`.data/store.json` + `.data/uploads/`) into Supabase.

## 2. Fix image upload (owner couldn't upload anything — reproduce first)
Pipeline: `src/components/drawer/add-view.tsx` → `src/lib/image/process.ts` → `/api/items/analyze` → `/api/upload` → `/api/items`. Check, in this order:
- Browser console/network on the first upload. `@imgly/background-removal` downloads its model from `staticimgly.com` at runtime; `device: "gpu"` may throw without WebGPU → retry with `"cpu"`.
- iPhone HEIC photos: `createImageBitmap` fails on HEIC in non-Safari browsers → convert (e.g. `heic2any`) or fall back to `<img>` decoding.
- Large files / proxy body limits on `/api/upload` (8MB cap in route), Supabase bucket missing or RLS denying the insert.
- Surface every failure to the user (toast + retry) instead of silent stage `"error"`; never block saving if cut-out fails (fallback to original).
- Add an end-to-end Playwright test that uploads a real photo fixture.

## 3. Image management
- In the item sheet: replace / delete the front image, add/delete back & extra images (`items.images`), delete the files from storage too.
- Broken or missing images (404, deleted file): show a clean placeholder with "Re-upload" / "Delete item" actions; add a cleanup action for orphaned items.

## 4. 3D models from the uploaded front/back photos
- Owner wants this now. Use a hosted image-to-3D API that accepts multi-view input (evaluate Tripo, Meshy, fal.ai Hunyuan3D / TRELLIS — compare quality on a few real garments, cost per model, licensing). Key in `.env.example`.
- Run as an async job (`/api/items/[id]/model3d` → poll/webhook), store the GLB in storage, record it in `items.images` with `view: "model3d"` (extend `ImageView`).
- Render with `@google/model-viewer` (or react-three-fiber) in the item sheet: soft studio lighting, auto-rotate, drag to orbit, matches the theme. 2D cut-out stays the default everywhere else.
- Quality bar: if a garment comes out lumpy/plastic, don't show it — keep the 2D view and offer "regenerate". Shoes/bags/caps first.

## 5. Better stylist + custom components
- Run the eval prompts in `docs/STYLIST.md` against the real model; improve `src/lib/ai/skills/index.ts` and `system-prompt.ts`; log results.
- Richer chat components (see `add-stylist-tool` skill): weather card, outfit alternatives carousel with swap buttons, "wore it today" action, product cards with real images/prices from web search.

## 6. Deploy
- Vercel project from `shobky/outfits`, env vars set (Supabase, OpenAI, 3D key), `LOCAL_PERSIST` irrelevant there.
- Domain `outfits.shobky.com`: add in Vercel → Domains, CNAME `outfits` → `cname.vercel-dns.com` at the shobky.com DNS provider (confirm with owner).
- Check: login flow on the live URL, upload from an iPhone over HTTPS, PWA install, `maxDuration` for chat/3D routes.
- Update `docs/PLAN.md` and `docs/DEPLOY.md` with what was done.
