-- One fitting-room operation per account, including across serverless instances.
create table public.try_on_leases (
  user_id uuid primary key references auth.users on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.try_on_leases enable row level security;

create function public.acquire_try_on_lease(lease_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare acquired uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.try_on_leases (user_id, token, expires_at)
  values (auth.uid(), lease_token, now() + interval '4 minutes')
  on conflict (user_id) do update set token = excluded.token, expires_at = excluded.expires_at
    where public.try_on_leases.expires_at < now()
  returning user_id into acquired;
  return acquired is not null;
end;
$$;
create function public.release_try_on_lease(lease_token uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.try_on_leases where user_id = auth.uid() and token = lease_token;
$$;
revoke all on function public.acquire_try_on_lease(uuid) from public, anon;
revoke all on function public.release_try_on_lease(uuid) from public, anon;
grant execute on function public.acquire_try_on_lease(uuid) to authenticated;
grant execute on function public.release_try_on_lease(uuid) to authenticated;
