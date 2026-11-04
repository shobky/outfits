-- Background photo intake. A batch is one upload (up to 8 photos); the AI sorts it
-- into groups, one per physical garment. Rows survive the app being closed, so
-- progress is never lost. Groups have their own rows so parallel work can't
-- overwrite each other's updates.
create table public.intake_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  photos text[] not null default '{}',
  status text not null default 'analyzing' check (status in ('analyzing','processing','done','failed')),
  error text,
  rejected jsonb not null default '[]'::jsonb,
  cost_usd numeric(8,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index intake_batches_user_idx on public.intake_batches (user_id, created_at desc);

create table public.intake_groups (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.intake_batches on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','added','review','failed','dismissed')),
  step text,
  -- [{ photo_url, view, rotation, result_url, ai, error }]
  views jsonb not null default '[]'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  description text,
  facts text,
  confidence real not null default 0,
  question text,
  error text,
  item_id uuid references public.items on delete set null,
  cost_usd numeric(8,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index intake_groups_batch_idx on public.intake_groups (batch_id);
create index intake_groups_user_idx on public.intake_groups (user_id, created_at desc);

alter table public.intake_batches enable row level security;
alter table public.intake_groups enable row level security;
create policy "own intake batches" on public.intake_batches for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own intake groups" on public.intake_groups for all using (user_id = auth.uid()) with check (user_id = auth.uid());
