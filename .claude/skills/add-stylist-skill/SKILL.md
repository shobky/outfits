---
name: add-stylist-skill
description: Add or improve the stylist's styling knowledge (color, fit, dress codes, weather, culture, shopping). Use when outfits feel generic or wrong.
---
# Improve stylist taste

Knowledge lives in `src/lib/ai/skills/index.ts` as small, opinionated markdown "skills" the agent loads with `load_skill` (progressive disclosure: only `name: description` is in the system prompt).

Rules for a good skill:
- `description` = when to load it ("Load when…"). The model only sees this until it loads.
- Body: concrete, testable rules (temperatures, pairings, ratios), not vibes. ≤ 40 lines.
- Prefer rules that reference item attributes we store (formality 1–5, warmth 1–5, colors, material, seasons, occasions).
- Never let a rule override the user's stated preferences (`profile.avoid`, style keywords).

Evaluate: write 5–10 prompts in `docs/STYLIST.md` → "Eval prompts", run them against the real model before/after, compare outfits. Note regressions there.
