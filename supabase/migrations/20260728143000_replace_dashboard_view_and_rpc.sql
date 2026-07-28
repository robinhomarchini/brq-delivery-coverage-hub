-- Replace dashboard metric view and update RPC in a single transaction.
--
-- PostgreSQL 15+ restricts CREATE OR REPLACE VIEW on objects with dependent
-- references that would change shape. To safely add canonical_total_target
-- without breaking dependent RPC executors, this migration drops the view,
-- recreates it with the new column, and replaces the RPC in one transaction.

drop view if exists public.vw_customer_dashboard_metrics;

create view public.vw_customer_dashboard_metrics
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
  coalesce(bb.total_target, ct.revenue, 0) as canonical_total_target,
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

create or replace function public.get_executive_dashboard_summary(
  p_target_year integer default 2026,
  p_include_new_logos boolean default false,
  p_hunter_scope_enabled boolean default false,
  p_hunter_customer_ids text[] default '{}'
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  result json;
begin
  with filtered as (
    select
      v.customer_id,
      v.customer_name,
      v.canonical_total_target,
      v.board_total_target,
      v.board_hunter_target,
      v.board_farmer_renewal_target,
      v.person_hunter_allocated,
      v.person_farmer_allocated,
      (v.person_hunter_allocated + v.person_farmer_allocated) as allocated_people_total
    from vw_customer_dashboard_metrics v
    where v.target_year = p_target_year
      and (p_include_new_logos or v.counts_toward_target)
      and (
        not p_hunter_scope_enabled
        or v.customer_id = any(p_hunter_customer_ids)
      )
  )
  select json_build_object(
    'summary', json_build_object(
      'totalTarget', coalesce(sum(f.canonical_total_target), 0),
      'boardTotalTarget', coalesce(sum(f.board_total_target), 0),
      'hunterTarget', coalesce(sum(f.board_hunter_target), 0),
      'farmerRenewalTarget', coalesce(sum(f.board_farmer_renewal_target), 0),
      'allocatedPeopleTotal', coalesce(sum(f.allocated_people_total), 0),
      'peopleDelta', coalesce(sum(f.allocated_people_total) - sum(f.canonical_total_target), 0),
      'achievementPercentage', case when coalesce(sum(f.canonical_total_target), 0) > 0 then round(sum(f.allocated_people_total) / sum(f.canonical_total_target) * 100, 2) else 0 end,
      'customerCount', count(*)
    ),
    'financialByCustomer', coalesce((
      select json_agg(row_to_json(t))
      from (
        select
          f.customer_name as "customerCluster",
          f.allocated_people_total as "revenueCurrent",
          f.canonical_total_target as "revenueTarget",
          f.person_hunter_allocated as "hunterRevenue",
          f.person_farmer_allocated as "deliveryFarmerRevenue"
        from filtered f
        order by greatest(f.allocated_people_total, f.canonical_total_target) desc
        limit 10
      ) t
    ), '[]'::json)
  ) into result
  from filtered f;

  return result;
end;
$$;
