-- Metric Integrity: single source of truth for customer target relationships.
--
-- This view prevents double counting between:
--   - board_target_baselines
--   - customer_target_years
--   - revenue_target_allocations (person allocations)
--   - studio_target_allocations (area allocations)
--
-- Key relationships:
--   - operational_revenue = hunter_target + farmer_renewal_target
--   - board_total_target = board_hunter_target + board_farmer_renewal_target
--   - person_hunter_allocated already includes studio hunter (contained)
--   - person_farmer_allocated already includes studio maintenance (contained)
--   - studio_allocated is the separate studio target breakdown
--
-- SECURITY INVOKER so RLS on underlying tables still applies.

create or replace view public.vw_customer_dashboard_metrics
as
select
  c.id as customer_id,
  c.name as customer_name,
  ct.target_year,
  ct.hunter_target,
  ct.farmer_renewal_target,
  ct.revenue as operational_revenue,
  ct.studio_hunter_target,
  ct.studio_target,
  ct.counts_toward_target,
  coalesce(bb.hunter_target, 0) as board_hunter_target,
  coalesce(bb.farmer_renewal_target, 0) as board_farmer_renewal_target,
  coalesce(bb.total_target, 0) as board_total_target,
  coalesce(pta.hunter_allocated, 0) as person_hunter_allocated,
  coalesce(pfa.farmer_allocated, 0) as person_farmer_allocated,
  coalesce(sta.studio_allocated, 0) as studio_allocated,
  coalesce(sta.studio_hunter_allocated, 0) as studio_hunter_allocated,
  coalesce(sta.studio_maintenance_allocated, 0) as studio_maintenance_allocated
from public.customers c
join public.customer_target_years ct on ct.customer_id = c.id
left join public.board_target_baselines bb
  on lower(regexp_replace(trim(bb.customer_name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(c.name), '\s+', ' ', 'g'))
  and bb.baseline_year = ct.target_year
  and bb.scenario = 'board_approved'
  and bb.approved = true
left join (
  select customer_id, target_year, sum(amount) as hunter_allocated
  from public.revenue_target_allocations
  where target_type = 'hunter'
  group by customer_id, target_year
) pta on pta.customer_id = c.id and pta.target_year = ct.target_year
left join (
  select customer_id, target_year, sum(amount) as farmer_allocated
  from public.revenue_target_allocations
  where target_type = 'farmer_renewal'
  group by customer_id, target_year
) pfa on pfa.customer_id = c.id and pfa.target_year = ct.target_year
left join (
  select
    customer_id,
    target_year,
    sum(amount) as studio_allocated,
    sum(hunter_amount) as studio_hunter_allocated,
    sum(maintenance_amount) as studio_maintenance_allocated
  from public.studio_target_allocations
  group by customer_id, target_year
) sta on sta.customer_id = c.id and sta.target_year = ct.target_year;
