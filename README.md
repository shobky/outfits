# Drawer

**Your wardrobe, digitised, with a stylist that knows every piece you own.**

Snap photos of your clothes → they become clean, professional cut-outs in a digital drawer → chat with an AI stylist that knows your closet, the weather, the occasion and local culture, and builds outfits from what you actually own → get smart suggestions for what's missing.

Mobile-first PWA · works great on desktop · dark by default.

| Drawer | Stylist asks | Outfit board | Saved outfits |
|---|---|---|---|
| ![](docs/screenshots/m-drawer.png) | ![](docs/screenshots/m-ask.png) | ![](docs/screenshots/m-outfit-board.png) | ![](docs/screenshots/m-outfits.png) |

![Desktop stylist](docs/screenshots/d-chat.png)

## Run it (zero config)
```bash
pnpm install
pnpm dev
```
With no env vars it runs in **demo mode**: a seeded closet in memory plus a scripted "Demo stylist" that runs the real agent tools. Add keys in `.env.local` (see `.env.example`) for real AI and persistence.

## Stack
Next.js 16 (App Router, Cache Components) · AI SDK v7 + OpenAI · Supabase (Postgres, Auth, Storage) · Tailwind v4 · Radix · Streamdown · in-browser background removal (@imgly, ONNX) · Open-Meteo weather · Vercel.

## Docs
- [Plan & roadmap](docs/PLAN.md)
- [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Design system](docs/DESIGN.md)
- [Stylist (prompt, skills, evals)](docs/STYLIST.md) · [Research & decisions](docs/RESEARCH.md)
- [Deploy to drawer.shobky.com](docs/DEPLOY.md)
- Agents (Claude Code / Codex): [AGENTS.md](AGENTS.md)
