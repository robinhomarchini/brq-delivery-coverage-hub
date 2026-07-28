-- Executive Dashboard Summary RPC
--
-- Returns a JSON summary from vw_customer_dashboard_metrics.
-- Designed to prevent double counting by using the view as the single
-- source of truth for target/allocation relationships.
--
-- SECURITY INVOKER so RLS on the underlying view tables still applies.

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
      v.operational_revenue,
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
      'totalTarget', coalesce(sum(f.operational_revenue), 0),
      'boardTotalTarget', coalesce(sum(f.board_total_target), 0),
      'hunterTarget', coalesce(sum(f.board_hunter_target), 0),
      'farmerRenewalTarget', coalesce(sum(f.board_farmer_renewal_target), 0),
      'allocatedPeopleTotal', coalesce(sum(f.allocated_people_total), 0),
      'peopleDelta', coalesce(sum(f.allocated_people_total) - sum(f.operational_revenue), 0),
      'achievementPercentage', case when coalesce(sum(f.operational_revenue), 0) > 0 then round(sum(f.allocated_people_total) / sum(f.operational_revenue) * 100, 2) else 0 end,
      'customerCount', count(*)
    ),
    'financialByCustomer', coalesce((
      select json_agg(row_to_json(t))
      from (
        select
          f.customer_name as "customerCluster",
          f.allocated_people_total as "revenueCurrent",
          f.operational_revenue as "revenueTarget",
          f.person_hunter_allocated as "hunterRevenue",
          f.person_farmer_allocated as "deliveryFarmerRevenue"
        from filtered f
        order by greatest(f.allocated_people_total, f.operational_revenue) desc
        limit 10
      ) t
    ), '[]'::json)
  ) into result
  from filtered f;

  return result;
end;
$$;
