-- Make wardrobe photos private. The app now serves them through the
-- authenticated /api/wardrobe/[name] proxy instead of public object URLs,
-- so a photo address alone no longer opens it.
-- Reads stay owner-scoped through the existing "wardrobe read own folder"
-- select policy (0002); this only stops anonymous public access.
update storage.buckets set public = false where id = 'wardrobe';
