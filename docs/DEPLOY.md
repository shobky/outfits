# Deploy: Supabase + Vercel + outfits.shobky.com

## What's live
| Piece | Where |
|---|---|
| Database, auth, storage | Supabase project `outfits` (`ngjfafpsljnfpbptkahy`), Frankfurt, free plan |
| App | Vercel project `outfits` (Hobby), deploys on push to `main`, functions in `fra1` |
| Domain | `outfits.shobky.com`. DNS for `shobky.com` is at Hostinger |

## Supabase
- Apply everything in `supabase/migrations/` in order.
- Auth → URL Configuration: Site URL `https://outfits.shobky.com`; Redirect URLs `https://outfits.shobky.com/auth/callback` and `http://localhost:3000/auth/callback`. Add others (such as a preview URL) here or login links fall back to the Site URL.

### Email limits
The built-in mailer is for testing. It only delivers to addresses on the project's team and allows two email messages per hour. That limit is controlled by Supabase Auth, so application code cannot raise it. To lift this:
1. Add custom SMTP under Auth → Emails → SMTP Settings. It needs an email provider and a verified sender domain.
2. Edit "Magic link or OTP" to include `{{ .Token }}`. The ready-to-paste template in `supabase/templates/magic_link.html` also uses the token-hash callback so a link can be opened in another browser.
3. Set `NEXT_PUBLIC_AUTH_EMAIL_CODE=1` in Vercel and redeploy. The login page then shows a code box.

**Why it matters:** a standard Supabase PKCE email link needs the browser that requested it. Outfits also accepts a `token_hash` link at `/auth/callback`; that route creates the session in whichever browser opens the email. Deploy the callback handler before replacing the dashboard template. Until then, keep the default `{{ .ConfirmationURL }}` link and use the code option when the custom template is available.

## Vercel env vars (production)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `VISION_MODEL`, `ALLOWED_EMAILS`.

`ALLOWED_EMAILS` matters: anyone can request a sign-in email and the app spends on your OpenAI key. Leave it set.

`vercel.json` sets `framework: nextjs`. Don't remove it: a project created with `vercel project add` has no framework preset, builds "successfully", and serves only `public/`, so every route is a 404.

## Domain
CNAME at Hostinger: `outfits` → `d6031e8cffec7f09.vercel-dns-017.com` (the value Vercel asked for). HTTPS is issued automatically. Check with `vercel domains verify outfits.shobky.com`.

## Local
```
cp .env.example .env.local   # fill in, or leave empty for local demo mode
pnpm install
pnpm dev
```
With Supabase values in `.env.local`, local dev requires sign-in. Remove them to go back to local mode.

## Importing local data
`node scripts/import-local.mjs --email you@example.com` is a dry run; add `--apply` to write. It skips the sample garments unless you pass `--include-samples`. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, and the user must have signed in once.

## Tests
`pnpm exec playwright test` builds in local mode with no keys, so it costs nothing and never touches Supabase or `.data/`. Screenshots land in `test-results/screens/`.
