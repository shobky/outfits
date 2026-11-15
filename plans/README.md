# Outfits UI implementation plans

| Order | Plan | Priority | Effort | Depends on | Status |
|---|---|---|---|---|---|
| 001 | [Mobile saved try-ons and outfit actions](001-mobile-saved-try-ons-and-outfit-actions.md) | P1 | Medium | None | DONE |

Implemented on 2026-11-15 on `codex/pwa-ui-improvements`. The archive uses one full-width row at all viewport widths because Profile's content column remains narrow. Outfit actions use an automatically sized grid that collapses empty columns when try-on is unavailable.

Verification included production build, type checking, lint, focused browser tests, and populated archive/outfit checks at 320, 390 and 1440 px in both themes. Confirmed cancel and failure recovery for saved-preview deletion, and focus recovery after successful deletion. Physical-device installed-PWA and enlarged system text checks remain pending.

The accompanying audit fixes cover chat loading/retry/cancellation, attachment preview cleanup, failed item saves, Drawer reset/retry, Profile shortcuts/retry, Shop hierarchy, upload expectations, and repeated-slot outfit boards. Across the integrated runs, 39 distinct Playwright tests passed. Lint retained two existing image-element warnings.
