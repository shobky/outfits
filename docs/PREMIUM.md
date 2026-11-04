# Premium features: test results and plan

Nothing here is built yet. Status: tested on the owner's 8 worn photos, 2026-11. Lives on `feat/beta`.

## What the test showed
Low-resolution screenshots (237–605 px, except one at 1170 px), `gpt-image-2.5-sunburst`, medium quality. **Test cost $0.27 in total**: about $0.02 per image, $0.033 for three photos combined, $0.0093 for the vision call. Judged by eye; only the jacket has a real reference photo.

| Question | Result | Verdict |
|---|---|---|
| All 3 items from one photo | Shirt, shorts and Crocs all came out clean | **Yes, as believable pieces.** Details are guessed: the shirt's print isn't its real print, cargo pockets are unverified, and the Crocs needed a hint because vision only saw "black shoes" |
| One garment from several photos | The shirt from 3 photos was clearly closer than from 1 | **Yes, and it's the biggest quality gain**, for about 1.6x the cost |
| Same garment across photos, without faces | Linked the shirt across 3 photos at 97% | **Partly.** It also merged different shoes and over-merged trousers, so ask the owner to confirm |
| Reference check: jacket from a worn photo | Right type, pockets and colour, less distressed than the real one | **Usable** |
| Hard cases | Red jacket kept the black top as "lining". Red shirt's print is invented | **Needs review.** Confidence should send these to the owner |
| Hanging, neat pair, laid flat | All good | **Yes** |
| Folded | Jeans looked like a skirt | **No.** Drop it |
| Try-on (own photo) | Believable fit and print, with slight changes to the person | **Promising.** Needs portrait output, and the owner should judge the likeness |

**Rule of thumb:** a worn photo gives a believable product shot, not a record of the real garment. Mark these as AI reconstructed (`images[].ai`), and always keep the source photo.

## Not face recognition
Decided by the owner: **tap yourself once, and match clothes against the drawer.** No face profile is stored. A face profile is biometric data with legal risk, and it would also scan friends who never agreed. The body "matrix" should be what people type in (height, build, sizes) plus try-on from their own photo. Automatic body measurements from photos are untested.

Group photos weren't tested whole, because the other person was cropped out by choice. Tap-to-select needs testing with someone's consent, or by cropping locally, which is the safer design anyway: **crop on the device so only the chosen person is sent.**

## Feature flags
Goal: friends can't break the bank, and the owner controls everything from one place.

| Flag | Feature | Cost per use |
|---|---|---|
| `worn_extract` | Pieces from worn photos | about $0.02 per piece |
| `multi_photo` | Combine photos of one garment | about $0.033 |
| `display_styles` | Hanging, neat pair, straight | about $0.02 per version |
| `try_on` | See it on yourself | about $0.03 |

- **Per person, off by default.** Add `features text[]`, `studio_allowance int` and `daily_budget_usd` to a member record. The server checks them, never the browser alone.
- **Global off switch for each feature**, so anything can be stopped at once.
- Every feature records its spend through `record_ai_spend`, with its own `kind`, and stops at that person's budget.

## Owner dashboard (`/admin`)
Only for addresses in `ALLOWED_EMAILS`, checked on the server. Reads need a server-side role key, so the key's handling needs design first.

1. **People:** who joined, pieces, last seen, spend. Toggle features and set limits per person.
2. **Invites:** create, copy, revoke, see who used what.
3. **Spend:** today, this week, by feature, plus the off switches.
4. **Beta health:** week-2 return, pieces per user, shop taps (the queries in `docs/BETA.md`).

Build order: flags and member settings → spend per feature → People and Invites → the rest. Until then, SQL does the job.

## Decisions for the owner
1. Which features to build first. Suggested: `multi_photo`, then `worn_extract`, then `try_on`.
2. A stylist chat message cap, needed before invites.
3. Whether a "reconstructed" label shows on AI-made pieces. Suggested: yes.

## UI issues noted for final polish (PWA)
Reported by the owner, not yet fixed:
- Toasts don't get out of the way. Check swipe to dismiss and overlap with the notch.
- Drawers can't be closed by swiping the handle: it's only a decoration in `src/components/ui/sheet.tsx`.
- Padding and layout of headers and content at the end of screens.
- Desktop and web haven't been tested as thoroughly.
