<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Outfits — agent guide

**Outfits** — AI wardrobe PWA: photograph your clothes → clean cut-outs in a digital **Drawer** → an agentic **Stylist** chat that styles you from what you own (weather, occasion, culture aware) → **Shop** suggestions for real gaps.

Read before working: `docs/PLAN.md` (roadmap + what's next), `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DESIGN.md`, `docs/STYLIST.md`, `docs/RESEARCH.md` (why each tool was picked).

## Stack (verify APIs in node_modules — versions are newer than most training data)
- **Next.js 16.4** App Router, `cacheComponents: true`, `src/proxy.ts` (not middleware). Docs: `node_modules/next/dist/docs/`.
- **AI SDK v7** (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`). Docs: `node_modules/ai/docs/`. Note v7 names: `instructions` (not `system`), `isStepCount`, `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`, `MockLanguageModelV4` from `ai/test`.
- **Supabase** (Postgres + Auth magic link + Storage) via `@supabase/ssr`. Schema: `supabase/migrations/`.
- Tailwind v4 (tokens in `src/app/globals.css`), Radix primitives, `lucide-react`, `streamdown` (markdown/code), `swr`, `sonner`, `next-themes`.
- pnpm. Node 22.

## Commands
- Setup: `cp .env.example .env.local && pnpm install && pnpm dev`
- `pnpm dev` · `pnpm build` · `pnpm lint` · `npx tsc --noEmit`
- `node scripts/gen-demo-assets.mjs` (demo SVG garments) · `node scripts/gen-icons.mjs` (PWA icons via Playwright)
- Before calling work done: `pnpm lint && npx tsc --noEmit && pnpm build`, then drive the UI (see `.claude/skills/verify-ui/SKILL.md`).

## Modes (important)
- No `NEXT_PUBLIC_SUPABASE_*` → **local mode**: seeded repo (`src/lib/data/demo.ts`), no login, persisted to `.data/store.json` + `.data/uploads/` (served by `/api/files/[name]`). In-memory only on Vercel or with `LOCAL_PERSIST=0`.
- No `OPENAI_API_KEY` (or model "demo") → **Demo stylist**: scripted `MockLanguageModelV4` (`src/lib/ai/mock-model.ts`) that still runs real tools.
- Everything goes through the `Repo` interface (`src/lib/data/repo.ts`). Never call Supabase directly from routes/components — add a repo method to BOTH implementations.

## Conventions
- Mobile-first. Every screen must work at 390px and 1440px. Bottom glass tab bar on mobile, side rail ≥ lg.
- Use design tokens (`bg-surface`, `text-muted`, `bg-tile`, `bg-accent`…), never raw hex in components. Pills are `rounded-full`; cards `rounded-[26px]`+.
- Accent (lime) = AI / active state only.
- Taxonomy values live in `src/lib/taxonomy.ts` (text columns in DB — no migration needed to add values).
- AI tools live in `src/lib/ai/tools.ts`. "Process" tools render in the collapsible steps drawer (`PROCESS_TOOLS` in `agent-steps.tsx`); "visual" tools render custom UI in `message.tsx` → `ToolBlock`.
- Styling knowledge = skills in `src/lib/ai/skills/index.ts`, loaded on demand by the `load_skill` tool. Improve taste there, not in the system prompt.
- Pages are thin static shells; data is fetched client-side via SWR from `/api/*` route handlers (`getRepo()` calls `connection()` so they're always dynamic).
- Never commit secrets (`.env*` is gitignored; document new vars in `.env.example`).

## Dev skills (how-tos for agents)
- `.claude/skills/add-stylist-tool/SKILL.md` — add a new AI tool end to end
- `.claude/skills/add-stylist-skill/SKILL.md` — add/improve styling knowledge
- `.claude/skills/verify-ui/SKILL.md` — screenshot + click-through with Playwright
- `.claude/skills/db-change/SKILL.md` — schema changes
