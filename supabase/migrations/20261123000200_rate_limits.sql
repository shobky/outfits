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

-- Atomically counts one hit for the key inside the current window and returns
-- whether it was allowed (count stayed within p_max). Fixed windows aligned to
-- the epoch: simple and good enough for burst control.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
begin
  if p_max < 1 or p_window_seconds < 1 then
    return true;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  perform 1
    from public.rate_limits
    where key = p_key and window_start = v_window and count >= p_max;
  if found then
    return false;
  end if;
  insert into public.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limits.count + 1;
  return true;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, integer, integer) to authenticated, service_role;

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
