-- Try-on identity references and user-reviewed qualitative observations.
-- These are intentionally separate from the legacy single-photo column so older
-- clients keep working while the profile setup flow grows to multiple views.
alter table public.profiles add column try_on_photos jsonb not null default '[]'::jsonb;
alter table public.profiles add column try_on_insights jsonb;

-- Reference photos are served through the authenticated app route, never as
-- public URLs. The existing wardrobe bucket remains public for garment cut-outs.
insert into storage.buckets (id, name, public)
values ('try-on', 'try-on', false)
on conflict (id) do update set public = false;

create policy "try-on upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'try-on' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "try-on read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'try-on' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "try-on delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'try-on' and (storage.foldername(name))[1] = auth.uid()::text);
