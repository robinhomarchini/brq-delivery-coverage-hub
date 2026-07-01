-- Recover legacy studio allocation amounts that were left in the compatibility
-- column after the Hunter/Maintenance split.
--
-- The previous corrective migration used COALESCE(maintenance_amount, amount),
-- but the new maintenance_amount column is NOT NULL DEFAULT 0. That made SQL
-- prefer zero over the real legacy amount. This migration explicitly reads the
-- legacy amount column when both split columns are still zero.

update public.studio_target_allocations
set
  hunter_amount = coalesce(hunter_amount, 0) + coalesce(amount, 0),
  maintenance_amount = 0,
  amount = 0,
  updated_at = now()
where coalesce(amount, 0) > 0
  and coalesce(hunter_amount, 0) = 0
  and coalesce(maintenance_amount, 0) = 0;

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
  'studio-legacy-amount-recovery',
  'Backfilled from legacy studio allocation amount as Studio Hunter.'
from (
  select
    customer_id,
    target_year,
    round(sum(coalesce(hunter_amount, 0)), 2) as allocated_hunter
  from public.studio_target_allocations
  group by customer_id, target_year
) totals
join public.customers customer on customer.id = totals.customer_id
where totals.allocated_hunter > 0
on conflict (customer_id, target_year) do update
set
  studio_hunter_target = greatest(coalesce(public.customer_target_years.studio_hunter_target, 0), excluded.studio_hunter_target),
  studio_target = 0,
  updated_at = now();

update public.customers customer
set
  studio_hunter_target = target.studio_hunter_target,
  studio_target = target.studio_target,
  revenue = coalesce(customer.hunter_target, 0) + coalesce(customer.farmer_renewal_target, 0) + coalesce(target.studio_target, 0)
from public.customer_target_years target
where target.customer_id = customer.id
  and target.target_year = 2026;

select
  target.target_year,
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
