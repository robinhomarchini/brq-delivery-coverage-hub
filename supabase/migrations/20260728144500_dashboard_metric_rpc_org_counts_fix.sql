-- Fix: people_scope must expose role_type and is_manager for the
-- people_summary CTE. Recreate the RPC to correct the column reference
-- introduced in 20260728144000_dashboard_metric_rpc_org_counts.sql.

create or replace function public.get_executive_dashboard_summary(
  p_target_year integer default 2026,
  p_include_new_logos boolean default false,
  p_hunter_scope_enabled boolean default false,
  p_hunter_customer_ids text[] default '{}',
  p_hunter_person_id text default null
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
  ),
  people_scope as (
    select distinct p.id, p.role_type, p.is_manager
    from public.people p
    where p.active = true
      and (
        not p_hunter_scope_enabled
        or p.id = p_hunter_person_id
        or exists (
          select 1
          from public.person_customer_assignments pca
          where pca.person_id = p.id
            and pca.customer_id = any(p_hunter_customer_ids)
        )
        or exists (
          select 1
          from public.revenue_target_allocations rta
          where rta.person_id = p.id
            and rta.customer_id = any(p_hunter_customer_ids)
            and rta.target_year = p_target_year
        )
        or exists (
          select 1
          from public.studio_target_allocations sta
          where (sta.hunter_person_id = p.id or sta.maintenance_person_id = p.id)
            and sta.customer_id = any(p_hunter_customer_ids)
            and sta.target_year = p_target_year
        )
      )
  ),
  people_summary as (
    select
      (select count(*) from people_scope) as active_people_count,
      (select count(*) from people_scope where role_type in ('Executive', 'Director')) as director_count,
      (select count(*) from people_scope where is_manager = true) as manager_count
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
      'customerCount', count(*),
      'activePeopleCount', coalesce((select active_people_count from people_summary), 0),
      'directorCount', coalesce((select director_count from people_summary), 0),
      'managerCount', coalesce((select manager_count from people_summary), 0)
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
