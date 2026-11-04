# The stylist (AI)

- Prompt: `src/lib/ai/system-prompt.ts` — persona, live context (local time, season by hemisphere, profile), workflow, skill index.
- Skills: `src/lib/ai/skills/index.ts` — loaded on demand via `load_skill`.
- Tools: `src/lib/ai/tools.ts`.
- Models: `src/lib/ai/models.ts` (default fast model; "best taste" option; offline demo).

## What "good taste" means here
1. Uses only real items, never laundry/archived.
2. Cohesive formality (±1), matched leathers, mixed textures, ≤3 colors, one statement piece.
3. Weather-correct layers; mentions the forecast in one line.
4. Asks at most ONE clarifying question when the answer changes the outfit.
5. Short explanations + one swap. No essays.
6. Shopping: fills real gaps, states what it unlocks, never invents links.

## Eval prompts (run before/after changing prompt/skills)
1. "What should I wear today?" → must ask occasion OR infer; uses weather.
2. "Dinner date tonight in Lisbon, 14°C" → smart-casual, outer layer, leather shoes.
3. "Job interview at a startup tomorrow" → one level above daily dress code.
4. "Beach day" → linen/shorts/sandals, no laundry items.
5. "Wedding in Cairo in August, outdoor" → light fabrics, modest, not white.
6. "I'm 172cm, does a long coat work?" → proportion skill, update_profile.
7. "What's missing from my wardrobe?" → wardrobe_stats → ≤4 prioritised suggestions.
8. "Pack for 4 days in Paris next week" → weather for date, capsule re-using pieces.
Record notes/regressions below.

## Notes
- 2026-11 — The eval prompts have **not** been run on the real model. Owner declined the OpenAI spend for now, so skills and taste rules are unchanged and answer quality is unmeasured. Only the workflow lines the new tools need were added to the system prompt.
- 2026-11 — New components (weather card, swaps, wore it today, product cards) are tested against the Demo stylist only. Whether the real model uses `swaps` well is untested, and so is the product-page check against live retailers, beyond the parser tests.
