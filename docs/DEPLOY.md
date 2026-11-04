# Deploy: Supabase + Vercel + drawer.shobky.com

## 1. Supabase (free)
1. https://supabase.com → New project (pick a region near you).
2. SQL editor → paste `supabase/migrations/0001_init.sql` → Run.
3. Auth → URL configuration: Site URL `https://drawer.shobky.com`; Redirect URLs add `https://drawer.shobky.com/auth/callback` and `http://localhost:3000/auth/callback`.
4. Project settings → API: copy URL + anon key.

## 2. Vercel (Hobby)
1. Import the GitHub repo → framework Next.js (auto).
2. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, optional `VISION_MODEL`.
3. Deploy.

## 3. Subdomain
Vercel → Project → Settings → Domains → add `drawer.shobky.com`. At your DNS provider for shobky.com add:
`CNAME  drawer  cname.vercel-dns.com`
(If shobky.com already uses Vercel DNS it's automatic.) HTTPS is issued automatically.

## 4. Local
```
cp .env.example .env.local   # fill in, or leave empty for demo mode
pnpm install
pnpm dev
```
