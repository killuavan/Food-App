create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_name text not null check (
    collection_name in (
      'inventoryItems',
      'consumptionLogs',
      'inventoryMovements',
      'groceryItems',
      'healthProfile',
      'weeklyMealPlans',
      'weeklyMealFavorites'
    )
  ),
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_name, record_id)
);

create index if not exists user_data_collection_updated_idx
  on public.user_data (user_id, collection_name, updated_at desc);

alter table public.user_data enable row level security;
revoke all on public.user_data from anon, authenticated;
grant select on public.user_data to authenticated;

drop policy if exists "Users can read their own data" on public.user_data;
create policy "Users can read their own data"
  on public.user_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own data" on public.user_data;
create policy "Users can insert their own data"
  on public.user_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
  on public.user_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own data" on public.user_data;
create policy "Users can delete their own data"
  on public.user_data for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.apply_user_data_changes(
  p_changes jsonb,
  p_expectations jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_payload jsonb;
  v_exists boolean;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_typeof(p_expectations) <> 'array' then
    raise exception 'Changes and expectations must be arrays' using errcode = '22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_expectations)
    order by value->>'collection_name', value->>'record_id'
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      v_user_id::text || ':' || (v_item->>'collection_name') || ':' || (v_item->>'record_id'), 0
    ));
    select payload into v_payload
      from public.user_data
      where user_id = v_user_id
        and collection_name = v_item->>'collection_name'
        and record_id = v_item->>'record_id'
      for update;
    v_exists := found;
    if v_exists is distinct from (v_item->>'exists')::boolean
      or (v_exists and v_payload is distinct from v_item->'payload') then
      raise exception 'Record changed; refresh and try again'
        using errcode = '40001';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_changes)
  loop
    if v_item->>'operation' = 'delete' then
      delete from public.user_data
        where user_id = v_user_id
          and collection_name = v_item->>'collection_name'
          and record_id = v_item->>'record_id';
    elsif v_item->>'operation' = 'upsert' then
      insert into public.user_data (user_id, collection_name, record_id, payload, updated_at)
      values (
        v_user_id,
        v_item->>'collection_name',
        v_item->>'record_id',
        coalesce(v_item->'payload', '{}'::jsonb),
        now()
      )
      on conflict (user_id, collection_name, record_id)
      do update set payload = excluded.payload, updated_at = now();
    else
      raise exception 'Unsupported data operation' using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_user_data_changes(jsonb, jsonb) from public, anon;
grant execute on function public.apply_user_data_changes(jsonb, jsonb) to authenticated;
