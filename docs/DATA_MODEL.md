# Data model

Source of truth: `supabase/migrations/0001_init.sql`, `src/lib/types.ts`, `src/lib/taxonomy.ts`.

```
auth.users ─┬─ profiles (1:1)   body, sizes, location (lat/lon for weather), taste, budget
            ├─ items            one physical garment
            ├─ outfits          items: [{item_id, slot}]  (jsonb — simple, ordered, no join table)
            ├─ wear_log         date + item_ids (+ outfit_id)
            ├─ wishlist_items   suggestions → saved → bought | dismissed
            └─ chats            AI SDK UIMessage[] as jsonb
storage: wardrobe/{user_id}/{uuid}.webp   (public-read, owner-write; files are removed with their photo or item)
```

## items — the core
| field | type | notes |
|---|---|---|
| category | text | `top · bottom · outerwear · onepiece · footwear · accessory` |
| subcategory | text | e.g. t-shirt, shirt, polo, sweater, jeans, chinos, shorts, sneakers, loafers… (`CATEGORIES`) |
| colors | text[] | named palette (`COLORS`), dominant first — enables color-harmony reasoning |
| pattern / material / fit | text | enums in taxonomy |
| seasons | text[] | spring/summer/autumn/winter (hemisphere handled at query time) |
| occasions | text[] | casual, smart-casual, business, formal, sport, beach, lounge, party, travel, date |
| formality | 1–5 | lounge → formal. Outfit cohesion = all pieces within ±1 |
| warmth | 1–5 | maps to weather bands (`weather-layering` skill) |
| image_url | text | processed front cut-out |
| original_image_url | text | the source photo (for re-processing later) |
| images | jsonb | `[{url, view: back\|detail\|worn, ai?}]` |
| description | text | AI one-liner used as styling context |
| status | active / archived | archived = kept but never suggested |
| in_laundry, is_favorite | bool | laundry items are excluded from outfits |
| wear_count, last_worn_at | | rotation awareness |

Why text instead of Postgres enums: the taxonomy will evolve weekly during prototyping; validation lives in zod/TS.

## Adding filters
Filtering happens in `src/lib/data/filters.ts` (shared by both repos). Closets are small; push to SQL only if a user has >2k items.

## Future
- `item_embeddings` (pgvector) for dedupe + "similar items" + worn-photo matching
- `events` (calendar/trips) feeding the stylist
- `products` cache for shopping results
