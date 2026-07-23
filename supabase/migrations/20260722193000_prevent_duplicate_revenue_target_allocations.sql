-- Prevent new duplicate direct target allocations while existing production
-- duplicates are reviewed through the temporary audit screen.
-- Grain: customer + person + target type + year.

create or replace function public.prevent_duplicate_revenue_target_allocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.revenue_target_allocations existing
    where existing.id <> new.id
      and existing.customer_id = new.customer_id
      and existing.person_id = new.person_id
      and existing.target_type = new.target_type
      and existing.target_year = new.target_year
  ) then
    raise exception
      'Duplicate revenue target allocation for customer %, person %, type %, year %',
      new.customer_id,
      new.person_id,
      new.target_type,
      new.target_year
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_revenue_target_allocations
  on public.revenue_target_allocations;

create trigger prevent_duplicate_revenue_target_allocations
before insert or update of customer_id, person_id, target_type, target_year
on public.revenue_target_allocations
for each row
execute function public.prevent_duplicate_revenue_target_allocation();

do $$
begin
  if not exists (
    select 1
    from pg_trigger trigger
    join pg_class relation on relation.oid = trigger.tgrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'revenue_target_allocations'
      and trigger.tgname = 'prevent_duplicate_revenue_target_allocations'
      and not trigger.tgisinternal
  ) then
    raise exception 'Duplicate prevention trigger was not created.';
  end if;
end $$;
