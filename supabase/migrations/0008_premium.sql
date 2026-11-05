-- Items from worn photos, try-on, and the owner dashboard.

-- ───────────────────────── worn photos ─────────────────────────
alter table public.intake_batches add column kind text not null default 'closet' check (kind in ('closet','worn'));
-- Pieces the AI recognised as already owned: [{ name, item_id }].
alter table public.intake_batches add column matched jsonb not null default '[]'::jsonb;
alter table public.intake_groups add column worn boolean not null default false;
-- The picture was reconstructed by AI from a photo of it being worn, so details may be guessed.
alter table public.items add column reconstructed boolean not null default false;

-- ───────────────────────── try-on ─────────────────────────
-- The person's own photo, kept only until they remove it.
alter table public.profiles add column try_on_photo_url text;
alter table public.ai_spend drop constraint ai_spend_kind_check;
alter table public.ai_spend add constraint ai_spend_kind_check check (kind in ('vision','studio','chat','try_on'));

-- ───────────────────────── owner dashboard ─────────────────────────
-- No policies: nobody can read or change this through the API. The owner's row is added
-- by hand in the SQL editor, so no address is committed to this public repo.
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Everything the dashboard shows. Refuses anyone who isn't in admins.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(p order by p.joined desc) from (
        select u.id, u.email, u.created_at as joined,
          (select max(e.created_at) from public.events e where e.user_id = u.id) as last_seen,
          (select count(*) from public.items i where i.user_id = u.id) as pieces,
          (select coalesce(sum(s.usd), 0) from public.ai_spend s where s.user_id = u.id) as spend_total,
          (select coalesce(sum(s.usd), 0) from public.ai_spend s where s.user_id = u.id and s.created_at >= today) as spend_today,
          coalesce((select f.features from public.member_features f where f.user_id = u.id), '{}') as features,
          (select m.invite_code from public.beta_members m where m.user_id = u.id) as invite_code,
          exists (select 1 from public.beta_members m where m.user_id = u.id) as member
        from auth.users u
      ) p), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(i order by i.created_at desc) from (
        select code, note, max_uses, used_count, created_at from public.invites
      ) i), '[]'::jsonb),
    'spend', coalesce((
      select jsonb_agg(s) from (
        select kind,
          coalesce(sum(usd) filter (where created_at >= today), 0) as today,
          coalesce(sum(usd) filter (where created_at >= now() - interval '7 days'), 0) as week,
          coalesce(sum(usd), 0) as total,
          count(*) as calls
        from public.ai_spend group by kind
      ) s), '[]'::jsonb),
    'health', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'median_pieces', (select coalesce(percentile_cont(0.5) within group (order by n), 0) from (select count(*) as n from public.items group by user_id) t),
      'shop_taps', (select count(*) from public.events where name = 'shop_suggestion_tap'),
      'old_enough', (select count(*) from (select user_id from public.events group by 1 having min(created_at) < now() - interval '14 days') t),
      'back_in_week_2', (
        select count(*) from (select user_id, min(created_at) as t0 from public.events group by 1) f
        where f.t0 < now() - interval '14 days' and exists (
          select 1 from public.events e where e.user_id = f.user_id and e.name = 'app_open'
            and e.created_at >= f.t0 + interval '7 days' and e.created_at < f.t0 + interval '14 days'
        )
      )
    )
  );
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

create function public.admin_set_features(person uuid, wanted text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  insert into public.member_features (user_id, features, updated_at) values (person, wanted, now())
  on conflict (user_id) do update set features = excluded.features, updated_at = now();
end $$;
revoke execute on function public.admin_set_features(uuid, text[]) from public, anon;
grant execute on function public.admin_set_features(uuid, text[]) to authenticated;

create function public.admin_create_invite(new_code text, new_note text, uses int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  insert into public.invites (code, note, max_uses) values (upper(trim(new_code)), new_note, greatest(uses, 1));
end $$;
revoke execute on function public.admin_create_invite(text, text, int) from public, anon;
grant execute on function public.admin_create_invite(text, text, int) to authenticated;

-- Existing members keep their access: their membership just loses the code.
create function public.admin_revoke_invite(old_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  delete from public.invites where code = old_code;
end $$;
revoke execute on function public.admin_revoke_invite(text) from public, anon;
grant execute on function public.admin_revoke_invite(text) to authenticated;
