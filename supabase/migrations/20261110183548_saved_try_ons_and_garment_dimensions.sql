alter table public.items add column garment_dimensions jsonb;
alter table public.items add column photo_geometry jsonb;

create table public.try_on_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  result_url text not null,
  recipe jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.try_on_runs enable row level security;
grant select, insert, delete on public.try_on_runs to authenticated;
create policy "read own try ons" on public.try_on_runs for select to authenticated using (user_id = (select auth.uid()));
create policy "save own try ons" on public.try_on_runs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete own try ons" on public.try_on_runs for delete to authenticated using (user_id = (select auth.uid()));
create index try_on_runs_user_created on public.try_on_runs (user_id, created_at desc);
