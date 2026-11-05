# Premium features: test results and plan

`multi_photo`, `worn_extract`, `try_on` and the `/admin` dashboard are built and live. All features are off by default. Status of the original test: tested on the owner's 8 worn photos, 2026-11. Lives on `feat/beta`.

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
| `worn_extract` | Pieces from worn photos. **Built.** One photo at a time, up to 5 new pieces, always reviewed. | $0.016 per piece, $0.003 to read the photo (one run) |
| `multi_photo` | Combine photos of one garment. **Built.** | $0.031 on the jacket with 2 close-ups, against $0.025 from one photo (one sample) |
| `display_styles` | Hanging, neat pair, straight | about $0.02 per version |
| `try_on` | See it on yourself. **Built.** 5 a day (`TRY_ON_DAILY_LIMIT`). Previews aren't saved. | $0.037 in 15s (one run, portrait) |

- **Per person, off by default.** Add `features text[]`, `studio_allowance int` and `daily_budget_usd` to a member record. The server checks them, never the browser alone.
- **Global off switch for each feature**, so anything can be stopped at once.
- Every feature records its spend through `record_ai_spend`, with its own `kind`, and stops at that person's budget.

**How it works today:** developers switch features in Profile's developer menu. For anyone else, run this in the SQL editor; users can read their row but can't write it. `FEATURE_MULTI_PHOTO=0` in Vercel stops it for everyone.
```sql
insert into public.member_features (user_id, features) values ('<user id>', '{multi_photo}')
on conflict (user_id) do update set features = excluded.features, updated_at = now();
```

## Owner dashboard (`/admin`)
Linked from the developer menu. Needs both an address in `ALLOWED_EMAILS` and a row in `public.admins`, which is added by hand so no address sits in this public repo. It works through security-definer functions that check `admins`, so no service-role key is needed on Vercel.

Shows spend today, this week and by kind; week-2 return, median pieces and shop taps; people with their features; and invites to create, copy and revoke. **Not built:** per-person allowances and budgets. Off switches stay in Vercel env vars.

## Decisions already made
Build order was `multi_photo`, `worn_extract`, `try_on`. AI-made pieces carry a "rebuilt by AI" note. Chat has a daily cap.

## UI issues noted for final polish (PWA)
Reported by the owner, not yet fixed:
- Toasts don't get out of the way. Check swipe to dismiss and overlap with the notch.
- Drawers can't be closed by swiping the handle: it's only a decoration in `src/components/ui/sheet.tsx`.
- Padding and layout of headers and content at the end of screens.
- Desktop and web haven't been tested as thoroughly.
