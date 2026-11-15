# Give saved try-ons and outfit actions room on mobile

P1 · Medium effort · Low-to-moderate interaction risk · UI/UX · No dependencies. Planned against `df67bcf` and the working tree on 2026-11-15.

## What the user sees today

Profile renders `SavedTryOns` inside a padded, max-width column (`src/components/views/me-view.tsx:93,194`). The archive uses `grid grid-cols-2 gap-3` at every width. Each card repeats a portrait, title, date, optional cost, fit disclaimer and a separate destructive button (`src/components/tryon/saved-try-ons.tsx:19–32`). Its `overflow-hidden` clips controls that extend past its edge. The shared small button is 32 px tall with a nonwrapping label (`src/components/ui/button.tsx:6,16`).

Measurements from Edge with three fixture runs in the existing local demo build:

| Viewport | Preview card width | Delete button width | Button extends past card by |
|---|---:|---:|---:|
| 320 px | 118 px | 154 px | 44 px |
| 390 px | 153 px | 154 px | 9 px |
| 1440 px | 246 px | 154 px | 0 px |

The Outfits footer uses `flex flex-wrap`, a primary button with a 130 px minimum, and up to three icon buttons (`src/components/views/outfits-view.tsx:77`). With try-on enabled at 320 px, Delete wrapped onto a line by itself. The wand is visually unlabeled. The existing entitlement check lives inside `TryOnButton` (`src/components/tryon/try-on.tsx:39`).

## Proposed layout

**Profile, phone.** Use one horizontal card per saved look. A portrait thumbnail about 80 × 120 px sits on the left, with a wrapping title and date beside it. The thumbnail and text form one generously sized open button. Give each card a separate 44 × 44 px More button, named for the look. Put the fit caveat once under the section heading. Keep the cost and timestamp in the existing Saved look details. Use a same-size fallback if the thumbnail fails. Keep the title readable and the preview openable in that state.

Show the latest three looks initially, with **Show all N** and **Show fewer** only for longer histories. Use the returned history order after verifying it is newest-first. Keep expansion in memory while a preview is open. At wider sizes allow two portrait cards only when the archive itself has room for two cards of at least 220 px plus their gap. Profile stays narrow even at desktop viewport widths.

**Outfits, phone.** Put the favorite toggle next to the outfit title and a labeled **More** control or accessible ellipsis beside it, with room for the title to wrap above the controls on narrow cards. Give **Wore it today** and the labeled **Try it on** their own footer. Use two equal columns when labels fit; stack the two full-width actions at narrow card widths or enlarged text. When try-on is unavailable, the wear button fills the footer. Keep Delete inside More, followed by the existing confirmation. Apply the hierarchy per card so narrow desktop grid columns also benefit.

## Implementation sequence and verification

1. **Capture both populated states.** Read the applicable Next guide in `node_modules/next/dist/docs/`, project design tokens in `docs/DESIGN.md`, and `.claude/skills/verify-ui/SKILL.md`. Start from the live working tree. Run `git diff df67bcf -- src/components/tryon src/components/views/outfits-view.tsx src/components/views/me-view.tsx tests/e2e`. Compare the excerpts above and preserve concurrent edits. Use the GET fixture pattern from `tests/e2e/tryon-history.spec.ts` with stable IDs, distinct photos, long titles and optional costs. Stub usage in both entitlement states. Verify that both the populated archive and enabled outfit action are visible before measuring.
2. **Rebuild the archive in `src/components/tryon/saved-try-ons.tsx`.** Keep the section ID, SWR loading/error/retry/empty branches, and existing `TryOnSheet initialRun={selected}` entry. Keep snapshot comparison, download and explicit recreation reachable. Use the existing accessible Sheet or an existing accessible action-menu primitive for More. Its Delete action must name the selected look, keep the confirmation about reference copies, call DELETE only after confirmation, prevent duplicate submission, surface failure, and refresh history on success. Return focus to the trigger on cancel, or the next surviving card/section heading after deletion. Verify via `pnpm exec playwright test tests/e2e/tryon-history.spec.ts` with the profile cases below added.
3. **Rebuild the footer in `src/components/views/outfits-view.tsx`.** Preserve the board's garment targets, laundry indicator, favorite pressed state, wear logging and duplicate-day feedback. Give the outfit use of `TryOnButton` a labeled, minimum-44-px presentation in `src/components/tryon/try-on.tsx`; leave other callers' sizing intact. Keep the existing feature gate and sheet opener. Match the archive's More interaction and focus handling. Reuse existing surface, tile, primary and muted tokens. Run `pnpm exec playwright test tests/e2e/screens.spec.ts tests/e2e/stylist.spec.ts tests/e2e/tryon-ui.spec.ts` with the outfit regression cases added to the relevant spec. Expect the existing behaviors and the new checks to pass.
4. **Verify through both public routes.** Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`; expect exit 0. Use the repo Playwright config for local demo data. Capture populated /me#saved-try-ons and /outfits in light and dark at 320, 390 and 1440 px. Check enlarged text, keyboard operation, return focus, bottom navigation clearance and the last card in each list. Record any physical-device checks separately.

## Acceptance tests

- At each specified width, action bounds remain within the card, sibling targets do not intersect, and phone actions have at least 44 × 44 px hit areas. Inspect element rectangles against the clipping ancestor; page-wide overflow alone missed the original bug.
- Test zero, one, three and four runs, a long unbroken title, missing cost, a failed thumbnail and a failed history load followed by Retry. With four runs, expand, open the fourth, verify its download matches its ID, close and confirm the fourth remains visible. Opening history makes zero generation requests.
- Cancel deletion and assert zero DELETE requests. Confirm deletion and assert one request for the selected ID, correct remaining count and keyboard focus. Simulate a failed delete and verify the card survives with feedback. Deleting from four to three removes the redundant expansion control.
- With the outfit feature on, tapping the labeled control opens its sheet. With the feature off, verify the wear action occupies the footer. Exercise favorite, wear, garment details, and cancel/confirm outfit deletion with local fixtures. Confirm More is reachable by keyboard and closes with Escape.

## Scope and handoff

Change the archive, outfit-card footer, the outfit-specific try-on trigger presentation, and focused tests in the specs named above. Preserve API contracts, private image URLs, storage, billing, generation and history ordering. Inspect current API sorting before implementing the initial three. If the required ordering or metadata is unavailable, report the discrepancy before changing a backend contract. Profile shortcuts from the earlier audit can land independently. A future action belongs in the footer only if it is frequent enough to justify displacing one of these two labeled actions.

Use a `codex/` branch if a branch is needed. Review the actual diff against the existing uncommitted UI changes and update the plan index after verification.
