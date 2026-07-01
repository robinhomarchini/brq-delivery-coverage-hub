-- Reclassify legacy Áreas / Studios values as Studio Hunter.
--
-- Before the split between Studio Hunter and Studio Maintenance/Renewal, the
-- project stored a single "studio" value. The business decision after the split
-- is that all values entered before this correction represent Studio Hunter:
-- they are contained inside the customer's Hunter target and must not be added
-- again to total revenue.

with moved_customer_targets as (
  update public.customer_target_years
  set
    studio_hunter_target = greatest(
      coalesce(studio_hunter_target, 0),
      coalesce(studio_hunter_target, 0) + coalesce(studio_target, 0)
    ),
    studio_target = 0,
    updated_at = now()
  where coalesce(studio_target, 0) > 0
  returning customer_id, target_year, studio_hunter_target
),
moved_customer_compat as (
  update public.customers
  set
    studio_hunter_target = greatest(
      coalesce(studio_hunter_target, 0),
      coalesce(studio_hunter_target, 0) + coalesce(studio_target, 0)
    ),
    studio_target = 0,
    revenue = coalesce(hunter_target, 0) + coalesce(farmer_renewal_target, 0)
  where coalesce(studio_target, 0) > 0
  returning id
),
moved_allocations as (
  update public.studio_target_allocations
  set
    hunter_amount = coalesce(hunter_amount, 0) + coalesce(maintenance_amount, amount, 0),
    maintenance_amount = 0,
    amount = 0,
    updated_at = now()
  where coalesce(maintenance_amount, amount, 0) > 0
  returning customer_id, target_year
),
allocation_hunter_totals as (
  select
    customer_id,
    target_year,
    round(sum(coalesce(hunter_amount, 0)), 2) as allocated_hunter
  from public.studio_target_allocations
  group by customer_id, target_year
),
upsert_missing_target_years as (
  insert into public.customer_target_years (
    customer_id,
    target_year,
    hunter_target,
    farmer_renewal_target,
    studio_hunter_target,
    studio_target,
    source_file,
    notes
  )
  select
    customer.id,
    totals.target_year,
    coalesce(customer.hunter_target, 0),
    coalesce(customer.farmer_renewal_target, greatest(customer.revenue - coalesce(customer.hunter_target, 0), 0), 0),
    totals.allocated_hunter,
    0,
    'studio-legacy-reclassification',
    'Backfilled from legacy studio allocations as Studio Hunter.'
  from allocation_hunter_totals totals
  join public.customers customer on customer.id = totals.customer_id
  where not exists (
    select 1
    from public.customer_target_years target
    where target.customer_id = totals.customer_id
      and target.target_year = totals.target_year
  )
  returning customer_id, target_year
),
sync_target_years_to_allocations as (
  update public.customer_target_years target
  set
    studio_hunter_target = greatest(coalesce(target.studio_hunter_target, 0), totals.allocated_hunter),
    updated_at = now()
  from allocation_hunter_totals totals
  where target.customer_id = totals.customer_id
    and target.target_year = totals.target_year
    and coalesce(target.studio_hunter_target, 0) < totals.allocated_hunter
  returning target.customer_id, target.target_year
)
update public.customers customer
set
  studio_hunter_target = target.studio_hunter_target,
  studio_target = target.studio_target,
  revenue = coalesce(customer.hunter_target, 0) + coalesce(customer.farmer_renewal_target, 0) + coalesce(target.studio_target, 0)
from public.customer_target_years target
where target.customer_id = customer.id
  and target.target_year = 2026;

-- Smoke-test summary: maintenance should be zero for values migrated from the
-- old single studio field, and Studio Hunter targets should cover allocations.
select
  target.target_year,
  count(*) filter (where coalesce(target.studio_hunter_target, 0) > 0) as customers_with_studio_hunter,
  round(sum(coalesce(target.studio_hunter_target, 0)), 2) as studio_hunter_target,
  round(sum(coalesce(target.studio_target, 0)), 2) as studio_maintenance_target,
  round(sum(coalesce(allocation_totals.allocated_hunter, 0)), 2) as allocated_studio_hunter,
  round(sum(coalesce(allocation_totals.allocated_maintenance, 0)), 2) as allocated_studio_maintenance
from public.customer_target_years target
left join (
  select
    customer_id,
    target_year,
    sum(coalesce(hunter_amount, 0)) as allocated_hunter,
    sum(coalesce(maintenance_amount, 0)) as allocated_maintenance
  from public.studio_target_allocations
  group by customer_id, target_year
) allocation_totals
  on allocation_totals.customer_id = target.customer_id
 and allocation_totals.target_year = target.target_year
group by target.target_year
order by target.target_year desc;
