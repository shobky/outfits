# Research & decisions

Researched Nov 2026. Prices change — re-check before scaling.

## Background removal ("photo → professional PNG")
Goal: realistic, clean product-style cut-outs (not AI-redrawn clothes).

| Option | Cost | Quality | Notes |
|---|---|---|---|
| **@imgly/background-removal** (ISNet, ONNX in browser) — **chosen for v0** | Free, runs on device | Good on clear photos; weaker on sheer/knit edges | Private, no server. ~40MB model cached after first run. **AGPL-3.0** → fine for personal/open source, replace before closed commercial launch |
| BiRefNet via Replicate | ~$0.0005/img (≈$0.51 / 1k) | Best open model in public comparisons | MIT repo; check weights' license. ~3s on GPU |
| Photoroom API | ~$0.02/img | Very good for e-commerce products | Commercial, easy |
| remove.bg | most expensive | Very accurate | Commercial |
| rembg (self-host) | free + compute | Good | Python service needed |

Pipeline (`src/lib/image/process.ts`): downscale → remove bg → trim to alpha bounds → center on 1200² transparent canvas with 8% padding → WebP. The **shadow is rendered in CSS** (`.garment` drop-shadow), not baked, so items sit naturally on any surface/theme. "Scripts + AI": scripts handle framing/normalisation; AI only segments (no hallucinated pixels).

Upgrade path: add `/api/cutout` using Replicate BiRefNet when `REPLICATE_API_TOKEN` is set; keep the browser path as fallback. Optional "Studio" step (gpt-image edit → ghost-mannequin/pressed look) should be opt-in and flagged as AI-enhanced.

## Recognition / tagging
Vision LLM with structured output (`/api/items/analyze`, AI SDK `Output.object` + zod enums from the taxonomy). Small JPEG on white keeps tokens low. Model configurable via `VISION_MODEL`.

## Front/back + 3D
- Front/back photos: implemented (`items.images`). Cheap, useful now.
- Image-to-3D (TRELLIS, Hunyuan3D, Meshy, Tripo): good for rigid objects (shoes, bags, caps); soft garments come out lumpy and "plastic", which hurts the realism goal. Revisit in Phase 3, starting with shoes/accessories. Store GLB URL in `items.images` with a new view `model3d` when we do.

## Items from worn / Instagram photos (Phase 2)
Most users won't photograph every item. Proposed pipeline:
1. User uploads photos of themselves (we don't scrape Instagram; uploads only — respects ToS & privacy).
2. Detect + segment garments on the person: open-vocabulary detection (Grounding-DINO / Florence-2) + SAM 2 masks, or a clothes-parsing model (e.g. SegFormer trained on ATR/LIP "human parsing"). A vision LLM can label the crops.
3. Dedupe against the closet with image embeddings (CLIP/SigLIP or a fashion-tuned variant, stored with pgvector in Supabase) — "is this the same navy overshirt?".
4. New item → crop is the "worn" image; optionally generate a clean flat product shot (gpt-image edit) marked `ai: true` so the UI can badge it as reconstructed.
5. Every confirmed sighting also becomes a `wear_log` entry → automatic rotation data.

## Chat UI
- **AI SDK v7** `useChat` + tool parts, `sendAutomaticallyWhen` for client-side tools (`ask_user`). Vercel's **AI Elements** pattern was followed (it's shadcn-style copy-in components built on Streamdown); its registry wasn't reachable from the build sandbox, so equivalent components were written in `src/components/chat/` using the same building blocks (`streamdown` + `@streamdown/code` for streaming markdown, Shiki highlighting and copy buttons). You can still pull individual AI Elements later with `npx ai-elements@latest add <component>`.
- Mock model (`MockLanguageModelV4`) gives a full agent loop offline.

## Weather
**Open-Meteo** forecast + geocoding: free, no key, 16-day forecast. Non-commercial terms — get a commercial plan or switch provider when monetising.

## Shopping suggestions
- v0: OpenAI `web_search` tool (provider-executed) gives real links + sources; suggestions saved via `suggest_purchases`.
- Later: structured product search (SerpApi Google Shopping, or affiliate networks with product feeds) for reliable images/prices.

## Hosting / data (free tiers)
- **Vercel Hobby**: Next.js native, custom subdomain free. (Hobby is non-commercial — move to Pro when it's a business.)
- **Supabase Free**: Postgres 500MB, Storage 1GB, Auth included. Pauses after ~1 week inactivity — keep using it or upgrade. Enough for thousands of items.
- Alternative considered: Cloudflare R2 for images if storage grows (zero egress).

## Prior art (for inspiration, not copied)
- `andrewheejay/Lime` — Next.js + Supabase wardrobe with weather-aware recs (FastAPI + Gemini)
- `sabpdo/Treehacks-Fitz` — React + Supabase digital closet with OpenAI
- `ineffablesam/closet-ai` — Flutter + Supabase outfit swapping
Taxonomy loosely follows Fashionpedia / DeepFashion2 garment classes + Google Product Taxonomy apparel.
