`# Research & decisions
`
`Researched Nov 2026. Prices change — re-check before scaling.
`
`## Photo → studio shot (tested on real garments, 2026-11)
`The first version cut out backgrounds in the browser (@imgly, ISNet). It was removed: it needed a ~40MB download, ran single-threaded, depended on the phone's memory, lost everything if the app was closed, and is AGPL. Everything now runs on the server.
`
`Measured on a sideways photo of a distressed brown leather jacket and a black beanie, at 1024×1024 medium quality:
`
`| Model | Cost per image | Time | Result |
`|---|---|---|---|
`| **gpt-image-2.5-sunburst** (chosen) | $0.026 | ~29s | Most faithful once upright and given facts. Real transparency |
`| gpt-image-2.5-flare | $0.026 | ~21s | Close second. Low quality is $0.019 |
`| gpt-image-2 | $0.065 | ~40s | Good colour, but **paints a fake checkerboard** instead of transparency |
`| gpt-image-1.5 | $0.047 | ~21s | **Redesigned the jacket**: invented a brand label, lost the distressing |
`
`**The prompt mattered more than the model.** A generic prompt turned warm brown leather grey-olive with an invented texture. Rotating the photo upright first and passing facts from the vision step (exact colours, pockets, lining, label) fixed most of it, for no extra cost.
`
`What the pipeline does with that:
`1. One vision call for the whole batch, with 768px images, sorts photos into garments and returns rotation, details and retoucher facts. About $0.0035 for 3 photos.
`2. Each front and back goes through the image model, upright and with facts. Detail shots skip it.
`3. Plain code frames every result (\`src/lib/image/frame.ts\`): same canvas, same 8% padding. A check rejects fake transparency.
`
`Known limits: results are retouched, not photographic truth. Heavy textures can still gain some invented grain, and details the vision step misreads carry through (it reported zips on buttoned cuffs). So the real photo is always kept, and "Use my photo" is one tap away.
`
`Other options if costs or fidelity change: BiRefNet or Bria via fal for cut-out only (no restyling), Photoroom (~$0.02/img).
`
`## Recognition / tagging
`Vision LLM with structured output (`/api/items/analyze`, AI SDK `Output.object` + zod enums from the taxonomy). Small JPEG on white keeps tokens low. Model configurable via `VISION_MODEL`.
`
`## Front/back + 3D
`- Front/back photos: implemented (`items.images`). Cheap, useful now.
`- Image-to-3D (TRELLIS, Hunyuan3D, Meshy, Tripo): good for rigid objects (shoes, bags, caps); soft garments come out lumpy and "plastic", which hurts the realism goal. Revisit in Phase 3, starting with shoes/accessories. Store GLB URL in `items.images` with a new view `model3d` when we do.
`
`## Items from worn / Instagram photos (Phase 2)
`Most users won't photograph every item. Proposed pipeline:
`1. User uploads photos of themselves (we don't scrape Instagram; uploads only — respects ToS & privacy).
`2. Detect + segment garments on the person: open-vocabulary detection (Grounding-DINO / Florence-2) + SAM 2 masks, or a clothes-parsing model (e.g. SegFormer trained on ATR/LIP "human parsing"). A vision LLM can label the crops.
`3. Dedupe against the closet with image embeddings (CLIP/SigLIP or a fashion-tuned variant, stored with pgvector in Supabase) — "is this the same navy overshirt?".
`4. New item → crop is the "worn" image; optionally generate a clean flat product shot (gpt-image edit) marked `ai: true` so the UI can badge it as reconstructed.
`5. Every confirmed sighting also becomes a `wear_log` entry → automatic rotation data.
`
`## Chat UI
`- **AI SDK v7** `useChat` + tool parts, `sendAutomaticallyWhen` for client-side tools (`ask_user`). Vercel's **AI Elements** pattern was followed (it's shadcn-style copy-in components built on Streamdown); its registry wasn't reachable from the build sandbox, so equivalent components were written in `src/components/chat/` using the same building blocks (`streamdown` + `@streamdown/code` for streaming markdown, Shiki highlighting and copy buttons). You can still pull individual AI Elements later with `npx ai-elements@latest add <component>`.
`- Mock model (`MockLanguageModelV4`) gives a full agent loop offline.
`
`## Weather
`**Open-Meteo** forecast + geocoding: free, no key, 16-day forecast. Non-commercial terms — get a commercial plan or switch provider when monetising.
`
`## Shopping suggestions
`- v0: OpenAI `web_search` tool (provider-executed) gives real links + sources; suggestions saved via `suggest_purchases`.
`- Later: structured product search (SerpApi Google Shopping, or affiliate networks with product feeds) for reliable images/prices.
`
`## Hosting / data (free tiers)
`- **Vercel Hobby**: Next.js native, custom subdomain free. (Hobby is non-commercial — move to Pro when it's a business.)
`- **Supabase Free**: Postgres 500MB, Storage 1GB, Auth included. Pauses after ~1 week inactivity — keep using it or upgrade. Enough for thousands of items.
`- Alternative considered: Cloudflare R2 for images if storage grows (zero egress).
`
`## Prior art (for inspiration, not copied)
`- `andrewheejay/Lime` — Next.js + Supabase wardrobe with weather-aware recs (FastAPI + Gemini)
`- `sabpdo/Treehacks-Fitz` — React + Supabase digital closet with OpenAI
`- `ineffablesam/closet-ai` — Flutter + Supabase outfit swapping
`Taxonomy loosely follows Fashionpedia / DeepFashion2 garment classes + Google Product Taxonomy apparel.
