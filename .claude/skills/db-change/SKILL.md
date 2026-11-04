---
name: db-change
description: Change the Supabase schema safely for Drawer (new column/table) and keep demo mode in sync.
---
# DB change

1. Add a NEW migration `supabase/migrations/000N_<name>.sql` (never edit applied ones). Include RLS policies for new tables (`user_id = auth.uid()`).
2. Update types in `src/lib/types.ts`, the `Repo` interface, `demo.ts`, `supabase.ts`, and seed data in `demo-seed.ts`.
3. New taxonomy values (category, color, occasion…) need NO migration — edit `src/lib/taxonomy.ts`.
4. Apply: Supabase dashboard → SQL editor (paste) or `supabase db push`.
5. Update `docs/DATA_MODEL.md`.
