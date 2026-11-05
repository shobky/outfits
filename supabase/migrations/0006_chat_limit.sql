-- Daily stylist message limit, chat spend tracking, and the developer "limits off" switch.

-- Chat now records what it costs, so it counts toward the daily budget.
alter table public.ai_spend drop constraint ai_spend_kind_check;
alter table public.ai_spend add constraint ai_spend_kind_check check (kind in ('vision','studio','chat'));

-- The app ignores this unless the signed-in address is in ALLOWED_EMAILS, so setting
-- it directly gets a normal user nothing.
alter table public.profiles add column limits_off boolean not null default false;

-- Users can't read events, so this returns only their own count for the current UTC day.
-- Demo stylist messages cost nothing and aren't counted.
create function public.chat_messages_today() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.events
  where user_id = auth.uid()
    and name = 'chat_sent'
    and coalesce(props->>'demo', 'false') <> 'true'
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
$$;
revoke execute on function public.chat_messages_today() from public, anon;
grant execute on function public.chat_messages_today() to authenticated;
