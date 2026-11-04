# Design system

References: the "Closet" mock (soft grey gallery, white rounded cards, black active pill, floating tab bar), "Item recognition" scan UI, "Listing item" dashed drop zone, lime-glow AI accents.

Principles: **calm, round, tactile, honest.** Lots of air, one accent, real garments as the hero. Nothing decorative competes with the clothes.

## Tokens (`src/app/globals.css`)
| token | light | dark (default) | use |
|---|---|---|---|
| `bg` | #efefed | #0e1014 | app background |
| `surface` | #fff | #171a20 | cards, inputs |
| `surface-2` | #f3f3f1 | #1d2128 | chips, subtle fills |
| `tile` | #ececea | #20242b | behind garment cut-outs |
| `primary` | #151515 | #f1f2f4 | solid pills/CTAs (inverts per theme) |
| `accent` | #c8f05a | #c8f05a | AI + active states ONLY |
| `muted` / `faint` | text hierarchy | | |

Radii: pills `rounded-full`; item cards `26px` with 5px surface border (the "framed" look from the ref); sheets/boards `28–32px`.
Type: Geist Sans; page titles 22–24px semibold tight; body 15px; meta 12–13px.
Shadows: `shadow-soft` for UI; garments get `.garment` (layered drop-shadow) so cut-outs feel physical.
Motion: subtle — fade/zoom-in for boards (staggered 90ms), active:scale-[0.97] on press, shimmer text for agent activity.

## Layout
- Mobile (<1024): sticky blurred header (left action · centered title · right action), floating glass bottom tab bar with center "+" (hidden inside chat).
- Desktop (≥1024): 84px side rail; grids grow 2→3→4→5 columns. Chat: 280px collapsible history sidebar, 760px message column.

## Outfit board
`src/components/outfit/outfit-board.tsx` — percentage boxes per slot (outer/top/bottom/shoes/accessory) on a 4:5 canvas with small rotations, like a stylist's flat-lay. Tune `layout()` to change composition.

## Copy voice
Friendly, short, confident. "What are we dressing for?" not "Enter your query".
