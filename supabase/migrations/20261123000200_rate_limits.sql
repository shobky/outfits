-- Sliding-window rate limit counters for abuse protection (API burst control).
-- The table is never read by clients; the security-definer RPC is the only door.

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies: nobody reads or writes this table directly.

-- Atomically counts one hit for the caller inside the current window and
-- returns whether it was allowed. The user portion of the key always comes
-- from auth.uid(), never from the client, so nobody can burn another
-- member's allowance by guessing their UUID. The increment and the limit
-- decision are one statement, so a concurrent burst can't slip past the cap.
create or replace function public.rate_limit_hit(p_scope text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_key text;
  v_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_max < 1 or p_window_seconds < 1 then
    return true;
  end if;
  v_key := auth.uid()::text || ':' || p_scope;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits (key, window_start, count)
  values (v_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limits.count + 1
  where public.rate_limits.count < p_max
  returning count into v_count;
  return found;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, integer, integer) to authenticated;

-- Housekeeping: windows older than a day are dead weight.
create or replace function public.rate_limits_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke all on function public.rate_limits_cleanup() from public;
grant execute on function public.rate_limits_cleanup() to service_role;

-- Brute-force throttle for invite redemption, enforced inside the RPC itself so
-- direct PostgREST callers can't skip the allowance the Next route applies.
create or replace function public.redeem_invite(invite text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  row_ public.invites;
begin
  if me is null then return false; end if;
  if not public.rate_limit_hit('redeem', 10, 600) then return false; end if;
  if exists (select 1 from public.beta_members where user_id = me) then return true; end if;
  select * into row_ from public.invites where code = upper(trim(invite)) for update;
  if not found or row_.used_count >= row_.max_uses then return false; end if;
  update public.invites set used_count = used_count + 1 where code = row_.code;
  insert into public.beta_members (user_id, invite_code) values (me, row_.code);
  return true;
end $$;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
