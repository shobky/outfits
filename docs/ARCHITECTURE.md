# Architecture

```
Browser (PWA)
 ├─ pages (static shells) ── client views (SWR) ──► /api/* route handlers ──► getRepo() ──► Repo
 │                                                                              ├─ demoRepo (in-memory seed)
 │                                                                              └─ supabaseRepo (RLS, user cookie)
 ├─ Add flow: photo → @imgly bg removal (WASM/WebGPU) → frame → /api/items/analyze (vision) → /api/upload → /api/items
 └─ Stylist: useChat ──► /api/chat ──► streamText(model, instructions, tools, stopWhen: isStepCount(8))
                                         ├─ model: openai(id) | MockLanguageModelV4 (demo)
                                         ├─ tools: src/lib/ai/tools.ts  (repo + Open-Meteo + web_search)
                                         └─ onEnd → repo.saveChat(id, UIMessage[])
```

## Folders
```
src/app/(app)/          drawer (/), outfits, add, stylist, shop, me
src/app/api/            chat, items, items/[id], items/analyze, upload, outfits, wishlist, profile, chats
src/app/login, auth/    Supabase magic link
src/proxy.ts            session refresh + auth gate (no-op in demo mode)
src/components/ui/      primitives: button, chip, segmented, sheet, page-header, empty
src/components/drawer/  item card/sheet/form, filters, add flow
src/components/chat/    stylist view, composer, message renderer, agent steps, tool views
src/components/outfit/  OutfitBoard (flat-lay composer)
src/lib/ai/             models, system prompt, tools, skills, mock model
src/lib/data/           Repo interface + demo + supabase + shared filters
src/lib/image/          garment photo pipeline
src/lib/taxonomy.ts     categories/colors/occasions… (single source of truth)
```

## Agent loop
1. Client sends full `UIMessage[]` + `model` + `timeZone`.
2. Route builds instructions (date/time in user TZ, hemisphere-aware season, profile, closet size, skill index).
3. Model calls tools; process tools show in the steps drawer, visual tools render cards.
4. `ask_user` has no `execute` → stream ends → UI shows chips → `addToolOutput` → `sendAutomaticallyWhen` continues the loop.
5. Final messages persisted to `chats`.

## Adding a model provider
`pnpm add @ai-sdk/anthropic`, add entries to `MODELS` (`src/lib/ai/models.ts`), resolve in `/api/chat` by `provider`.
