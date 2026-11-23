-- Viral invites: every admitted member gets up to 5 codes to give out.
alter table public.invites add column if not exists created_by uuid references auth.users on delete cascade;

-- Members read only the codes they created. redeem_invite stays the only writer for uses.
create policy "own invites read" on public.invites for select to authenticated using (created_by = auth.uid());

-- Returns the caller's invites, topping up to 5 codes total. Only admitted
-- members (beta_members) may invite; codes are single-use, 8 chars, no
-- look-alike characters.
create function public.my_invites() returns setof public.invites
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  have int;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  i int;
begin
  if me is null then return; end if;
  -- Lock the membership row so concurrent first calls can't each mint 5 codes:
  -- the second caller waits, then sees the committed allocation.
  perform 1 from public.beta_members where user_id = me for update;
  if not found then return; end if;
  select count(*) into have from public.invites where created_by = me;
  while have < 5 loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.invites (code, note, max_uses, created_by) values (new_code, 'friend', 1, me);
      have := have + 1;
    exception when unique_violation then
      -- Rare collision: loop and try another code.
    end;
  end loop;
  return query select * from public.invites where created_by = me order by created_at;
end $$;
revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;
