-- Add Áreas / Studios as the third annual financial target component.
--
-- Customer master columns remain compatibility caches for current UI screens.
-- The canonical editable annual fact is customer_target_years keyed by
-- (customer_id, target_year), and people allocations are stored in
-- revenue_target_allocations by target_type.

alter table public.customers
  add column if not exists studio_target numeric(14,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_studio_target_check') then
    alter table public.customers
      add constraint customers_studio_target_check check (studio_target >= 0) not valid;
  end if;
end $$;

alter table public.customers validate constraint customers_studio_target_check;

update public.customers
set
  studio_target = coalesce(studio_target, 0),
  revenue = coalesce(hunter_target, 0) + coalesce(farmer_renewal_target, 0) + coalesce(studio_target, 0);

alter table public.customer_target_years
  add column if not exists studio_target numeric(14,2) not null default 0 check (studio_target >= 0);

-- Replace generated total so it includes the new target component.
alter table public.customer_target_years
  drop column if exists revenue;

alter table public.customer_target_years
  add column revenue numeric(14,2)
  generated always as (hunter_target + farmer_renewal_target + studio_target) stored;

alter table public.revenue_target_allocations
  drop constraint if exists revenue_target_allocations_target_type_check;

alter table public.revenue_target_allocations
  add constraint revenue_target_allocations_target_type_check
  check (target_type in ('hunter', 'farmer_renewal', 'studio')) not valid;

alter table public.revenue_target_allocations
  validate constraint revenue_target_allocations_target_type_check;

select
  target_year,
  count(*) as customers_with_target,
  round(sum(hunter_target), 2) as hunter_target,
  round(sum(farmer_renewal_target), 2) as farmer_renewal_target,
  round(sum(studio_target), 2) as studio_target,
  round(sum(revenue), 2) as revenue
from public.customer_target_years
group by target_year
order by target_year desc;
