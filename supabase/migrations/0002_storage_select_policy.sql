-- Storage needs SELECT on the row for remove() and upsert. Without this policy,
-- deleting a photo returns success and leaves the file in the bucket.
create policy "wardrobe read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
