# Shop retrieval research and beta approach

Research date: 10 November 2026. Target project: Outfits, `D:\outfits`.

## Recommendation

Use retailer data first, deterministic extraction second, and the model for matching and explaining. Do not make a model browse and interpret whole pages on every request. No new paid services are required for this approach. Generated try-on continues to use the existing paid image provider only when explicitly requested and enabled for the account.

No tool can guarantee retrieval from every retailer or obtain measurements that a retailer has not published. The useful guarantee is that the application does not invent a product photo, review, price, or measurement when retrieval fails.

## Retailer feasibility

| Source | Evidence and approach | Limits |
|---|---|---|
| Town Team | Live public Shopify product JSON and predictive-search JSON both returned HTTP 200. A sampled product exposed original images, variants, sizes and prices. Use those structured responses before HTML. | Product size labels do not establish centimetre measurements. Stock and prices can change. |
| DeFacto Egypt | The official Egypt storefront and men's page returned HTTP 200. A bounded public catalog/search adapter was added, but live search subsequently returned HTTP 403. | Search coverage is currently unverified/blocked. A reachable homepage does not establish that product data or a size chart was retrieved. |
| Amazon Egypt | A direct live search request returned HTTP 503 with a blocking page. Offer an Amazon search link and inspect a pasted product link when possible. | Do not claim reliable Amazon scraping. The official Creators API is a potential future integration, subject to marketplace enrollment, approval and credentials. |
| Other Egyptian/global stores | Use a reviewed retailer allowlist and structured Product / ProductGroup data on supported product pages. Ravin and LC Waikiki have official Egyptian storefronts; Ravin publishes size-chart pages. | A domain on the allowlist is not proof its extractor has passed live tests. Broaden coverage only with retailer fixtures and live acceptance checks. |

Shopify documents both [product JSON](https://shopify.dev/docs/api/ajax/reference/product) and [predictive search](https://shopify.dev/docs/api/ajax/reference/predictive-search). Amazon's [Creators API introduction](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction) currently lists marketplace enrollment, registration, credentials, and 10 qualifying sales in the preceding 30 days for PA API access through Creators API; its [regional authentication documentation](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/get-started/using-curl) lists EG among EU-region marketplaces. Egyptian storefront references: [Town Team sample product](https://townteam.com/products/5638971227), [DeFacto Egypt](https://www.defacto.com.eg/en-eg), [Ravin size charts](https://shop.iravin.com/pages/size-charts), [LC Waikiki Egypt](https://www.lcwaikiki.eg/en).

## Open-source tools and APIs

| Option | Appropriate use | Beta decision |
|---|---|---|
| Native Node fetch + retailer JSON / JSON-LD | Fast server-side extraction without a model call or extra service. | First choice. Strict URL, redirect, body-size, timeout and concurrency limits. |
| [Cheerio](https://github.com/cheeriojs/cheerio) — MIT | HTML extraction when structured data is missing and stable DOM selectors exist. | Useful if individual adapters grow; avoid a dependency until needed. |
| [Crawlee](https://github.com/apify/crawlee) — Apache 2.0 | Queues, retries, HTTP crawling and Playwright-backed rendering in TypeScript. | Preferred later browser-worker option, with a crawl budget. Do not run a browser for every beta search. Hosting/proxies still have costs. |
| [Scrapling](https://github.com/D4Vinci/Scrapling) — BSD 3-Clause | Python extraction with adaptive selectors and browser fetchers. | Worth testing for a specific failing retailer; a second runtime is unnecessary for stores whose JSON already works. |
| [Firecrawl](https://github.com/firecrawl/firecrawl) — AGPL 3.0 | Managed or self-hosted web extraction. | Not the default here: another service or a heavier self-hosted stack, plus license review. Open source does not mean hosted scraping is free. |
| [SerpApi](https://serpapi.com/pricing) | Structured discovery across indexed stores. | Optional future comparison: the checked page lists 250 searches/month free and a $25/month starter. No account or paid fallback is activated. A search result still needs product-page verification. |
| Amazon Creators API | Official Amazon product discovery/content where approved. | Future adapter after access is established. Do not confuse it with the advertising-campaign API. |

## Honest product facts and matching

- Keep retailer URL, retrieval timestamp, currency, image gallery, variant identity, availability, materials and source attribution together.
- Use retailer original image URLs when available. Preserve the whole garment with `object-contain`; provide a broken-image state. Do not generate or upscale a replacement and call it a real product image.
- Treat garment measurements, body size charts and packaging dimensions as different facts. Show the relevant units and source. Never infer centimetres from an ordinary product photo.
- Show a rating with its scale and review count only when supplied. Show only retrieved review excerpts. Missing reviews do not mean zero stars.
- Retrieve a small candidate set. Filter explicit price limits using the source currency; do not silently compare EGP with USD. Let the model compare shortlisted products against the user's own wardrobe and preferences.
- Report unavailable stores and missing size information. Do not rank an unavailable item as an exact in-stock match.
- A visual try-on is not a sizing engine: drape, identity and product details may be altered by generation. Keep the actual product gallery available for comparison.

## Cost controls

- Search and extraction make no model calls and have no new paid-provider fallback.
- Cache public facts briefly, coalesce identical in-flight fetches, and bound cache size and candidate counts. Public facts can be shared; personal photos, wardrobe details and generated previews cannot enter a shared product cache.
- Return compact search summaries to the model. Fetch detailed facts only for shortlisted or opened products. Do not send entire HTML or large galleries/review collections into the chat context.
- Prefer native shop tools over automatic paid web search for shopping. Existing chat-model use and explicit try-on generation still consume the existing provider budget.
- Process-local caches and throttles reduce waste but are not a distributed quota. Their contents disappear on cold starts.

## Try-on alternatives

Keep the existing provider for this beta rather than introducing GPU hosting or another paid API. [CatVTON](https://github.com/Zheng-Chong/CatVTON) is an interesting self-hosted comparison, but its published terms are non-commercial and it still requires GPU inference. It is not a cost-free drop-in replacement for a production service.

## Boundaries and follow-up flags

Only Shop and its shopping-tool / product-preview integrations are in scope. Do not change Drawer, account management, generic Stylist behavior, payments or deployment as part of this work.

Existing issues found while tracing dependencies, flagged for separate work:

- The chat route's spend calculation explicitly excludes provider web-search charges. Shopping guidance can avoid automatically using this tool, but the general accounting gap needs its own fix.
- Existing try-on allowance and global spend checks read totals before generating and record spend afterward. They are not atomic reservations across multiple server instances. Account gates and a local in-flight guard do not create a strict distributed spending ceiling.
- The data model documents public-read image storage, including personal try-on photos. Making personal media private requires a separate storage/access migration; no such migration is included here.

Production retailer permissions, image reuse conditions and API-specific storage/refresh rules should be checked when enabling each adapter. Do not bypass login, CAPTCHA, or other access controls.

## Implementation and validation evidence

Implemented locally, without pushing or deploying:

- Dedicated Shop product search and detail endpoints; the model has a compact `search_products` tool and richer product checks.
- Shared safe retrieval for product checks and shopping suggestions, with a trusted-store policy, DNS-pinned connections, validated redirects, bounded bodies/deadlines, short public-fact caches and coalesced requests.
- Product gallery and variant selection; selected Town Team variants retain their retailer IDs, prices and product links. Unknown availability stays unknown. Garment, body and package measurements remain distinct.
- Search, store and EGP price filters; wishlist filtering, currency-aware price sorting, duplicate handling, dismiss undo, and reviewed product-link import with editable fields.
- Shop products can enter the existing gated try-on flow through a verified gallery image. Generation remains explicit, with existing account allowances. Paid generation was not exercised during validation.

A live completed-app check retrieved the sampled Town Team product at **319 EGP**, with **7 images**, **7 variants**, and a primary image **2250 pixels wide**. The response contained no measurements or reviews; the UI correctly reports those fields as not retrieved. A live shirt search returned six products; DeFacto and Amazon remained unavailable. Retailers can throttle requests: one investigation request returned HTTP 429, which produced an unverified result rather than fabricated facts.

Parser regression tests cover recommendation exclusion, false product pages, unsafe images, explicit price units, numeric variant IDs, unknown stock, real numerical measurements and rating scales. Browser coverage includes product search/save/detail, variant identity, unavailable facts, a long gallery, populated wishlist layouts at 390px/1440px, light/dark themes, and existing Stylist/try-on behavior. UI test fixtures contain synthetic measurements and reviews for coverage; they are not retailer evidence. Files named `live-shop-product-*` use retrieved retailer data.

Limits: linked or image-only size charts are not automatically OCR-transcribed, reviews behind blocked/dynamic widgets may be unavailable, supported global retailer domains have not all passed live acceptance checks, and generated try-on fidelity has not been evaluated in this task. No production Supabase session or production deployment was tested.

Final validation on the completed source:

- Full repository ESLint: passed, zero warnings/errors.
- TypeScript `--noEmit --incremental false`: passed after the production build.
- Normal Next.js production build: passed. Windows sandbox restrictions required running the build outside the sandbox; no project build configuration was changed.
- Focused Playwright suite: **40 passed** across Shop, existing Stylist and existing premium/try-on behavior. AI keys and Supabase were disabled; tests used disposable local-mode state.
- Live completed-app smoke: Town Team product and search succeeded; original 2250px-wide images loaded at 390px and 1440px. Image containment and horizontal-overflow checks passed on both viewports.
- Actual diff restricted to Shop, its shopping-tool/product-preview integrations, tests and Shop documentation. Pre-existing untracked assets were preserved. Nothing was pushed or deployed.

Screenshots: [live desktop product](live-shop-product-desktop.png), [live mobile product](live-shop-product-mobile.png). Other `shop-*` screenshots are test-fixture UI captures, not proof of retailer measurements or reviews.
