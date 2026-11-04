-- Invite-only beta: spending limits, usage measurement, invites, account deletion.

-- ───────────────────────── AI spend ─────────────────────────
create table public.ai_spend (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('vision','studio')),
  usd numeric(8,4) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_spend_user_idx on public.ai_spend (user_id, kind);
create index ai_spend_created_idx on public.ai_spend (created_at);
alter table public.ai_spend enable row level security;
-- Read-only for users. Writes go through record_ai_spend, so nobody can insert a huge cost.
create policy "own ai_spend read" on public.ai_spend for select using (user_id = auth.uid());

-- One call can't honestly cost more than this, so anything above it is clamped.
create function public.record_ai_spend(spend_kind text, spend_usd numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.ai_spend (user_id, kind, usd)
  values (auth.uid(), spend_kind, greatest(0, least(coalesce(spend_usd, 0), 0.5)));
end $$;
revoke execute on function public.record_ai_spend(text, numeric) from public, anon;
grant execute on function public.record_ai_spend(text, numeric) to authenticated;

-- Everyone's total for today, without exposing anyone's rows. Drives the global daily cap.
-- Each person counts for at most $2, so one account calling the function repeatedly
-- can't use up the cap and switch studio shots off for everybody.
create function public.ai_spend_today() returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(per_user), 0) from (
    select least(sum(usd), 2) as per_user from public.ai_spend
    where created_at >= date_trunc('day', now()) group by user_id
  ) t;
$$;
revoke execute on function public.ai_spend_today() from public, anon;
grant execute on function public.ai_spend_today() to authenticated;

-- Why a piece didn't get a studio shot, shown to the owner.
alter table public.intake_groups add column note text;

-- ───────────────────────── measurement ─────────────────────────
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  -- Same list as src/lib/events.ts. Users can write here directly, so the limits live in the database.
  name text not null check (name in ('app_open','batch_created','piece_added','chat_sent','outfit_saved','worn_logged','shop_suggestion_tap','product_check')),
  props jsonb not null default '{}'::jsonb check (octet_length(props::text) <= 512),
  created_at timestamptz not null default now()
);
create index events_name_idx on public.events (name, created_at);
create index events_user_idx on public.events (user_id, created_at);
alter table public.events enable row level security;
-- Write-only for users. Reading is for the owner, through the SQL editor.
create policy "own events insert" on public.events for insert with check (user_id = auth.uid());

-- ───────────────────────── invites ─────────────────────────
create table public.invites (
  code text primary key,
  note text,
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0,
  created_at timestamptz not null default now()
);
-- No policies: users can't list or read codes. Only redeem_invite touches this table.
alter table public.invites enable row level security;

create table public.beta_members (
  user_id uuid primary key references auth.users on delete cascade,
  invite_code text references public.invites on delete set null,
  joined_at timestamptz not null default now()
);
alter table public.beta_members enable row level security;
create policy "own membership read" on public.beta_members for select using (user_id = auth.uid());

-- Row lock, so two people can't take the last use of a code at once.
create function public.redeem_invite(invite text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  row_ public.invites;
begin
  if me is null then return false; end if;
  if exists (select 1 from public.beta_members where user_id = me) then return true; end if;
  select * into row_ from public.invites where code = upper(trim(invite)) for update;
  if not found or row_.used_count >= row_.max_uses then return false; end if;
  update public.invites set used_count = used_count + 1 where code = row_.code;
  insert into public.beta_members (user_id, invite_code) values (me, row_.code);
  return true;
end $$;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- ───────────────────────── account deletion ─────────────────────────
-- Removes the signed-in user. Every table cascades from auth.users; the app removes storage files first.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
