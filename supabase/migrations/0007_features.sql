-- Premium features, off by default and switched on per person.

-- Ordinary users: they can read their own row but not write it, so a paid feature
-- can't be self-granted. The owner sets these in the SQL editor for now:
--   insert into public.member_features (user_id, features) values ('<user id>', '{multi_photo}')
--   on conflict (user_id) do update set features = excluded.features, updated_at = now();
create table public.member_features (
  user_id uuid primary key references auth.users on delete cascade,
  features text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.member_features enable row level security;
create policy "own features read" on public.member_features for select using (user_id = auth.uid());

-- Developers toggle their own from the developer menu. Like limits_off, the app
-- ignores this column unless the address is in ALLOWED_EMAILS.
alter table public.profiles add column dev_features text[] not null default '{}';
