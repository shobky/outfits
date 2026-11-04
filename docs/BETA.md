# Invite-only beta

Lives on branch `feat/beta`. **Not merged, not deployed, and migration 0005 isn't applied to production.** The owner decides when, once the product feels ready to show.

## Why a beta first
Cost isn't the main unknown. So far only one account has uploaded, so there's no evidence anyone comes back after the first upload. A small beta measures that before money goes into growth.

## Go public if
Week-2 return of at least 20–25%, and the typical user adds 10+ pieces. These are judgement calls, not benchmarks. If people upload once and vanish, fix the reason to return first.

## Before inviting anyone
1. Fix the product's outstanding UI/UX issues.
2. Apply `supabase/migrations/0005_beta.sql`, merge, deploy.
3. Set `INVITE_ONLY=1` in Vercel and keep your own address in `ALLOWED_EMAILS`.
4. **Custom email (SMTP)**: Supabase's built-in mailer only reaches team addresses, so invited people can't sign in without it. It also enables the sign-in code the home-screen app needs (`docs/DEPLOY.md`).
5. Set `NEXT_PUBLIC_CONTACT_EMAIL`, and have the privacy page reviewed.
6. **Private photos**: the bucket is public-read with unguessable addresses. The privacy page says so. Move to signed URLs before any public launch.
7. Test the hosted cut-out option (it failed locally), so people past their allowance get better than their raw photo.
8. Check storage: at about 400 KB–1 MB per photo, Supabase Free's 1 GB fills at around 33–80 users with 30 pieces each. Pro is from $25/month.

## Spending controls
| Setting | Default | Effect |
|---|---|---|
| `STUDIO_FREE_SHOTS` | 15 | AI studio shots per user, for life. Then their real photo is used |
| `AI_DAILY_BUDGET_USD` | 5 | Total for everyone per day. When reached, new pieces use real photos and details wait for the owner to fill in |
| `AI_STUDIO_ENABLED` | on | `0` turns studio shots off instantly |

Pieces always save. If limits can't be read, spending stops. Limits are checked just before each call, so simultaneous uploads can overshoot slightly.

Addresses in `ALLOWED_EMAILS` skip the personal allowance but still stop at the daily budget and off switch.

Each person counts for at most $2 toward the daily total, so one account can't use up the cap for everyone. The cost is that heavy use by a listed address is undercounted.

**Decide before inviting anyone: stylist chat has no cap.** A user can send unlimited messages on your key, and its cost is unmeasured. Add a per-user daily message limit first.

## Invites
Run in the Supabase SQL editor. One code per person makes it easy to see who came from where:
```sql
insert into public.invites (code, note, max_uses) values ('FRIEND-AHMED', 'Ahmed', 1);
```
Codes are matched in upper case.

## Reading the results
Run in the Supabase SQL editor. Users can't read `events`.

**Retention by signup week, returned in week 2:**
```sql
with first_seen as (select user_id, min(created_at) as t0 from public.events group by 1)
select date_trunc('week', f.t0)::date as cohort,
       count(*) as users,
       count(*) filter (where exists (
         select 1 from public.events e where e.user_id = f.user_id and e.name = 'app_open'
           and e.created_at >= f.t0 + interval '7 days' and e.created_at < f.t0 + interval '14 days'
       )) as back_in_week_2
from first_seen f group by 1 order by 1;
```

**Pieces per user:**
```sql
select percentile_cont(0.5) within group (order by n) as median, avg(n)::numeric(6,1) as mean, count(*) as users
from (select user_id, count(*) as n from public.items group by 1) t;
```

**Does shopping interest exist?**
```sql
select name, count(*), count(distinct user_id) as users from public.events
where name in ('shop_suggestion_tap', 'product_check') group by 1;
```

**AI cost per user and per day:**
```sql
select kind, sum(usd)::numeric(10,4) as usd, count(*) as calls, count(distinct user_id) as users from public.ai_spend group by 1;
select created_at::date as day, sum(usd)::numeric(10,4) as usd from public.ai_spend group by 1 order by 1 desc limit 14;
```

## Monetising later
Shop ships with honest suggestions and no money attached, while tap counts show whether buying interest exists. Then add disclosed affiliate links. No paid placement inside stylist advice. Earning money ends Vercel Hobby and Open-Meteo's free tier, so budget for both.
