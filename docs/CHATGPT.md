# Sign in with ChatGPT

"Continue with ChatGPT" signs someone in and runs their AI on their own Plus or Pro plan instead of `OPENAI_API_KEY`. OpenAI docs: https://developers.openai.com/siwc/token-sharing-open-source

## Where it works
OpenAI allows plan usage for open-source and local personal apps, with a redirect to `http://127.0.0.1:<port>/auth/callback`. So:

| Running | Button shown | Works |
|---|---|---|
| `pnpm dev` / `next start` on your computer | Yes | Yes |
| Vercel, or any other address | No | Needs OpenAI's approval |

To offer it on a hosted deploy, complete https://openai.com/form/sign-in-with-chatgpt-interest/. Don't route around the 127.0.0.1 rule.

## Setup
None in local mode. With Supabase configured, signing in needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, because a verified ChatGPT email becomes a Supabase session through the admin API. Someone already signed in can link a plan from their profile without it.

No client ID, secret or OpenAI project is involved: OpenAI registers a client per account on first sign-in.

## What a plan can do
| Feature | On a plan |
|---|---|
| Stylist chat, photo recognition | Yes, with the models the account's catalog lists |
| Web search | Subject to the account's policy |
| Studio shots | No: there's no image generation, so the framed photo is used |

Requests must set `store: false` and `stream: true`, which is why `analyzePhotos` uses `streamText`, and must not send `temperature`, `max_output_tokens` and similar. The full list is in OpenAI's preview limitations page.

A connected plan never falls back to the API key. Limits and errors are shown to the person (`explainAIError`).

## Code
- `src/lib/chatgpt/oauth.ts`: authorization, token exchange, ID token checks, refresh, revocation. Written from the protocol docs, not copied from the DevKit, whose licence is noncommercial.
- `src/lib/chatgpt/store.ts`: AES-256-GCM credentials in `.data/chatgpt.enc`, key in `~/.outfits/chatgpt.key`. Each account belongs to one Repo user, so nobody else on the computer spends it.
- `src/lib/ai/provider.ts`: `resolveAI(userId)` decides who pays. Everything that calls a model goes through it.
- `/auth/chatgpt/start`, `/auth/callback`, `/auth/chatgpt/status`, `/auth/chatgpt/disconnect`.
- `src/components/chatgpt.tsx`: button, welcome dialog, "Manage usage". Wording follows OpenAI's UI/UX guidelines.
