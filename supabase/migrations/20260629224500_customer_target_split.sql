alter table public.customers
  add column if not exists hunter_target numeric,
  add column if not exists farmer_renewal_target numeric;

with allocation_totals as (
  select
    customer_id,
    sum(amount) filter (where target_type = 'hunter' and target_year = 2026) as hunter_target,
    sum(amount) filter (where target_type = 'farmer_renewal' and target_year = 2026) as farmer_renewal_target
  from public.revenue_target_allocations
  where target_year = 2026
  group by customer_id
)
update public.customers customer
set
  hunter_target = coalesce(allocation_totals.hunter_target, 0),
  farmer_renewal_target = coalesce(allocation_totals.farmer_renewal_target, 0),
  revenue = coalesce(allocation_totals.hunter_target, 0) + coalesce(allocation_totals.farmer_renewal_target, 0)
from allocation_totals
where customer.id = allocation_totals.customer_id
  and coalesce(allocation_totals.hunter_target, 0) + coalesce(allocation_totals.farmer_renewal_target, 0) > 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_hunter_target_check') then
    alter table public.customers
      add constraint customers_hunter_target_check check (hunter_target is null or hunter_target >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customers_farmer_renewal_target_check') then
    alter table public.customers
      add constraint customers_farmer_renewal_target_check check (farmer_renewal_target is null or farmer_renewal_target >= 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'hunter_target'
  ) then
    raise exception 'customers.hunter_target was not created';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'farmer_renewal_target'
  ) then
    raise exception 'customers.farmer_renewal_target was not created';
  end if;
end $$;
