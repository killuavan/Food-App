create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default false,
  food_expiring_enabled boolean not null default true,
  food_expired_enabled boolean not null default true,
  low_stock_enabled boolean not null default true,
  out_of_stock_enabled boolean not null default true,
  grocery_reminder_enabled boolean not null default true,
  expiration_days integer not null default 3 check (expiration_days between 1 and 14),
  grocery_frequency text not null default 'WEEKLY' check (grocery_frequency in ('DAILY', 'WEEKLY')),
  time_zone text not null default 'UTC' check (length(time_zone) between 1 and 100),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

drop policy if exists "Users can read their notification preferences" on public.notification_preferences;
create policy "Users can read their notification preferences"
  on public.notification_preferences for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can create their notification preferences" on public.notification_preferences;
create policy "Users can create their notification preferences"
  on public.notification_preferences for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update their notification preferences" on public.notification_preferences;
create policy "Users can update their notification preferences"
  on public.notification_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_type text not null check (notification_type in (
    'FOOD_EXPIRING', 'FOOD_EXPIRED', 'LOW_STOCK', 'OUT_OF_STOCK', 'GROCERY_REMINDER'
  )),
  dedupe_key text not null,
  title text not null,
  summary text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  claim_until timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists notification_history_user_created_idx
  on public.notification_history (user_id, created_at desc);
create index if not exists notification_history_retry_idx
  on public.notification_history (status, next_attempt_at)
  where status in ('PENDING', 'FAILED');

alter table public.notification_history enable row level security;
revoke all on public.notification_history from anon, authenticated;
grant select on public.notification_history to authenticated;
drop policy if exists "Users can read their notification history" on public.notification_history;
create policy "Users can read their notification history"
  on public.notification_history for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.notification_item_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  stock_status text not null check (stock_status in ('good', 'low', 'out')),
  episode integer not null default 0 check (episode >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.notification_item_state enable row level security;
revoke all on public.notification_item_state from anon, authenticated;

create or replace function public.claim_notification_history(
  p_user_id uuid,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  update public.notification_history
  set attempts = attempts + 1,
      claim_until = now() + interval '10 minutes'
  where user_id = p_user_id
    and dedupe_key = p_dedupe_key
    and status in ('PENDING', 'FAILED')
    and attempts < 3
    and next_attempt_at <= now()
    and (claim_until is null or claim_until < now())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.claim_notification_history(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_notification_history(uuid, text) to service_role;

grant all on public.notification_preferences to service_role;
grant all on public.notification_history to service_role;
grant all on public.notification_item_state to service_role;
grant select on public.user_data to service_role;
