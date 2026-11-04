-- Drawer — initial schema. Apply with `supabase db push` or paste into the
-- Supabase SQL editor. Every table is owned by auth.users and protected by RLS.
-- Attribute values (category, colors, seasons…) are free text validated in the
-- app (src/lib/taxonomy.ts) so the taxonomy can evolve without migrations.

create extension if not exists "pgcrypto";

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  menswear text not null default 'menswear' check (menswear in ('menswear','womenswear','both')),
  height_cm int,
  weight_kg int,
  build text,
  skin_tone text,
  sizes jsonb not null default '{}'::jsonb,
  home_city text,
  country text,
  latitude double precision,
  longitude double precision,
  style_keywords text[] not null default '{}',
  favorite_colors text[] not null default '{}',
  avoid text[] not null default '{}',
  budget text check (budget in ('low','mid','high')),
  currency text not null default 'EUR',
  notes text,
  updated_at timestamptz not null default now()
);

-- auto-create a profile row on sign-up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── items ─────────────────────────
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  category text not null,
  subcategory text not null,
  colors text[] not null default '{}',
  pattern text not null default 'solid',
  material text,
  fit text,
  seasons text[] not null default '{}',
  occasions text[] not null default '{}',
  formality smallint not null default 2 check (formality between 1 and 5),
  warmth smallint not null default 2 check (warmth between 1 and 5),
  brand text,
  size text,
  image_url text,
  original_image_url text,
  -- extra views: [{ "url": text, "view": "back"|"detail"|"worn", "ai": bool }]
  images jsonb not null default '[]'::jsonb,
  description text,
  notes text,
  status text not null default 'active' check (status in ('active','archived')),
  in_laundry boolean not null default false,
  is_favorite boolean not null default false,
  wear_count int not null default 0,
  last_worn_at timestamptz,
  created_at timestamptz not null default now()
);
create index items_user_idx on public.items (user_id, status, category);

-- ───────────────────────── outfits ─────────────────────────
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  occasion text,
  notes text,
  source text not null default 'user' check (source in ('ai','user')),
  is_favorite boolean not null default false,
  weather jsonb,
  -- [{ "item_id": uuid, "slot": "top" | "bottom" | ... }]
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index outfits_user_idx on public.outfits (user_id, created_at desc);

-- what was worn when (powers "not worn in a while" + rotation awareness)
create table public.wear_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  outfit_id uuid references public.outfits on delete set null,
  item_ids uuid[] not null,
  worn_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- ───────────────────────── wishlist / suggestions ─────────────────────────
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  category text,
  subcategory text,
  color text,
  brand text,
  price numeric(10,2),
  currency text,
  url text,
  image_url text,
  retailer text,
  reason text,
  pairs_with uuid[] not null default '{}',
  priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'idea' check (status in ('idea','saved','bought','dismissed')),
  source text not null default 'ai' check (source in ('ai','user')),
  created_at timestamptz not null default now()
);

-- ───────────────────────── chats ─────────────────────────
-- Messages are stored as the AI SDK UIMessage[] JSON (recommended persistence shape).
create table public.chats (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chats_user_idx on public.chats (user_id, updated_at desc);

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.outfits enable row level security;
alter table public.wear_log enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.chats enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own items" on public.items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own outfits" on public.outfits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own wear_log" on public.wear_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own wishlist" on public.wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chats" on public.chats for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── storage ─────────────────────────
-- Public-read bucket with unguessable paths: {user_id}/{uuid}.webp
-- (switch to private + signed URLs before going multi-tenant at scale)
insert into storage.buckets (id, name, public) values ('wardrobe', 'wardrobe', true)
  on conflict (id) do nothing;

create policy "wardrobe upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
