-- OS share handoffs and web-push subscriptions. Both are private to the owner.

create table public.share_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text,
  text text,
  url text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day'),
  constraint share_intents_payload check (coalesce(length(title), 0) <= 240 and coalesce(length(text), 0) <= 4000 and coalesce(length(url), 0) <= 2048 and cardinality(photos) <= 4)
);
create index share_intents_user_idx on public.share_intents (user_id, created_at desc);
alter table public.share_intents enable row level security;
grant select, insert, delete on public.share_intents to authenticated;
create policy "own share intents" on public.share_intents for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint),
  constraint push_subscription_lengths check (length(endpoint) between 1 and 2048 and length(p256dh) between 1 and 256 and length(auth) between 1 and 256)
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id, updated_at desc);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy "own push subscriptions" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.events drop constraint if exists events_name_check;
alter table public.events add constraint events_name_check check (name in ('app_open','batch_created','piece_added','chat_sent','outfit_saved','worn_logged','shop_suggestion_tap','product_check','share_received'));
