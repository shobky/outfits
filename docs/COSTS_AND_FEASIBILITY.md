# Operating costs and feasibility — 11 November 2026

These are explicit planning scenarios, not an invoice forecast or a guarantee of
perfect output. Actual cost depends on token usage, reference-image resolution,
retries, retained photos, traffic, and provider billing. USD, before tax.

## Models and verified rates

Official sources: [OpenAI pricing](https://developers.openai.com/api/docs/pricing),
[deprecations](https://developers.openai.com/api/docs/deprecations),
[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[image generation](https://developers.openai.com/api/docs/guides/image-generation).
The configured API key's read-only model lookup returned 200 and no announced
shutdown date for Luna, Terra, and Image 2.6 Sunburst. Availability is not proof
of application quality.

| Workload | Default | Standard input / output per million tokens |
| --- | --- | --- |
| Chat, garment cataloguing, reviewed proportion observations | GPT-6 Luna | $0.10 / $0.50 |
| Optional developer comparison | GPT-6.1 Terra | $1 / $5 |
| Studio edits and try-on | Image 2.6 Sunburst, medium | text input $5; image input $8; image output $30 |

Luna cached reads cost $0.01/M, 30-minute cache writes $0.125/M. Terra reads
cost $0.05/M and writes $1.25/M. Requests above 272k input tokens use higher
rates. Paid web search adds $0.01 per call plus model tokens. Direct image edits
must not assume the Responses API's image-cache discount.

The previous app defaults (5.4 mini and Image 2.5 Sunburst) were not listed as
imminently retiring in the deprecations page inspected. Image 1.5 retires on
1 December 2026; Image 2 on 10 February 2027. Do not migrate historical test
records or claim every older model is deprecated.

## Unit economics

- A complete Luna turn totaling 10,000 input and 1,000 output tokens across all
  tool steps costs **$0.0015** with no cache. The previous 5.4 mini rate would
  cost $0.012: an 87.5% reduction for the same token counts. This is not a
  measured latency or quality comparison.
- A wardrobe recognition request with 2,000 billable input and 300 output
  tokens costs **$0.00035**. Image token counts vary; do not equate one photo
  with this fixed token count.
- Budget **$0.03 per studio view** and **$0.08 per try-on** initially. These
  are planning allowances, not published fixed per-image prices. Multiple
  person/garment references, output complexity and retries can increase them.
  The old 2.5 studio tests in RESEARCH measured around $0.026, but 2.6 and real
  try-on fidelity/latency have not been benchmarked here.
- One hundred new wardrobe studio views cost approximately **$3** before
  recognition, retries and storage. Front plus back count as two views.

## Monthly scenarios per active user

The table assumes Luna turns as above; the studio allowance includes routine
recognition approximately. A separate 20% contingency covers variability; it is
not a hard spending cap. Reopening a saved try-on costs no model call.

| Scenario | Chat turns | Studio views | Try-ons | Paid searches | AI subtotal | With 20% contingency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Light | 30 | 10 | 5 | 2 | $0.765 | $0.918 |
| Regular | 100 | 20 | 20 | 5 | $2.40 | $2.88 |
| Heavy | 600 | 60 | 100 | 20 | $10.90 | $13.08 |

These scenarios require allowances that actually permit the stated usage.
Current defaults grant only 15 lifetime studio shots, 20 daily messages and
5 daily try-ons, and a $5 daily shared AI budget. Raising those is a product
and deployment decision. The shared budget is checked before spending, not an
atomic reservation: concurrent work and failed telemetry can overshoot it.
Provider spending limits and alerts remain necessary; do not sell this as a
strict prepaid credit system.

## Infrastructure and scale

[Vercel Pro](https://vercel.com/pricing) starts at $20/month with $20 usage
credit; [Supabase Pro](https://supabase.com/pricing) starts at $25/month for
the first project. **$45/month is a starting platform floor**, not the full
operating bill. It excludes commercial weather, SMTP, domain renewal, taxes,
extra seats/compute, bandwidth overages, support and payment processing.

| Regular active users | AI including contingency | Plus $45 base platform |
| --- | ---: | ---: |
| 100 | $288 | $333/month ($3.33/user) |
| 1,000 | $2,880 | $2,925/month ($2.925/user) |
| 10,000 | $28,800 | $28,845/month ($2.8845/user) |

The last column is a subtotal, not a quote. Add measured infrastructure
overages and the excluded services. At scale, the $45 base assumption alone
will understate real infrastructure usage.

Supabase Pro includes 100GB file storage and 250GB uncached egress. Additional
storage is $0.0213/GB-month and uncached egress $0.09/GB. Private image routes
also consume Vercel delivery/compute. For example, at an assumed 5MB of saved
inputs plus result per run, 20 monthly runs add 100MB/user/month: 1,000 users
add about 100GB every month. After 12 months that is about 1,200GB before
wardrobe photos, or roughly $23.43/month of storage above the included 100GB.
Downloads/egress are separate and cannot be inferred from stored bytes.

[Open-Meteo](https://open-meteo.com/en/pricing) requires a paid licence for
commercial use; the opened pricing page did not establish a dollar amount.
Obtain its current quote and configure the customer endpoint before monetising.
SMTP provider, geography and email volume also need a concrete selection.

Exact monthly formula:

`platform base + sum(actual token/image/tool charges) + storage overage +
bandwidth/compute overage + weather + SMTP + domain + payment fees + tax`

## Cost and speed priorities

1. Reopen saved outputs without regeneration; label recreation as a new paid
   action. Keep the precise private input snapshots so changing the wardrobe
   does not silently change an old recipe.
2. Keep real-photo mode as the inexpensive, truthful default after the starter
   allowance. Offer studio retouch only when wanted. Process detail/label views
   without image generation. This saves more than shaving chat tokens.
3. Deduplicate identical operations per owner using a hash of image bytes,
   garment revisions, dimensions, reference choice, model and prompt version.
   Reuse an existing result only on exact agreement; never share personal
   image caches across users. This is a future improvement, not implemented.
4. Batch garment recognition (already present). Keep label crops at enough
   resolution to read size text, while reducing background pixels. Never
   infer centimetres from pixel dimensions.
5. Keep retailer lookup deterministic and cache public product facts with
   freshness timestamps. Use paid web search only when it adds value. Avoid a
   second model call merely to format UI.
6. Evaluate Luna first, route genuinely ambiguous visual cases to Terra only
   after a representative quality comparison. No automatic escalation is
   implemented yet. A larger model is not automatically better at fit.
7. Consider Batch for explicitly nonurgent catalogue jobs; do not impose its
   latency on an interactive fitting room. Keep interactive edits on Standard
   until measured latency justifies a premium tier.
8. Add durable job status and idempotent generation before large-scale launch.
   A browser disconnect must not encourage an unnecessary second paid job.

## Feasibility and quality boundaries

Saved comparisons, wardrobe-based styling, reviewed proportion observations,
private reference photos and reversible sharing are practical. A camera can
be opened only through the user's explicit interaction and browser permission.
Face references help visual continuity; they do not create verified biometric
maps or prove measurements.

Realistic size depiction needs selected garment size, actual flat dimensions,
body measurements, fabric stretch, construction and pose. S/M/L alone varies
by brand. A generative editor can be instructed not to resize clothes, but it
cannot guarantee that a small garment will produce physically correct tension
or that an oversized item will drape accurately. Exact fit requires a separate
measurement/calibration and garment-physics workflow; market this feature as
a visual preview. Never promise perfect quality and speed at any price.

Before releasing a quality claim, evaluate consented references across varied
body shapes, lighting, poses, skin tones, layered outfits, patterns, garment
sizes and fabrics. Score identity preservation, garment fidelity, relative
size, drape, failure rate and p50/p95 latency. Compare cost per *accepted*
result, including retries. No real-person image benchmark was performed here.
