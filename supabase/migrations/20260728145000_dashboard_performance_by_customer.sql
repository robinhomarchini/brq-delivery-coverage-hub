-- Add canonical dashboard performance metrics by customer.
--
-- This RPC exposes per-customer target and allocation breakdowns without
-- inventing current_revenue. Metrics are derived from the existing
-- vw_customer_dashboard_metrics view and person_customer_assignments, so
-- they reuse the canonical baseline/fallback and hunter-scope filters.
--
-- SECURITY INVOKER preserves RLS on the underlying tables/view.
-- No new indexes are introduced here; reuse existing predicates.

create or replace function public.get_dashboard_performance_by_customer(
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
    select distinct pca.customer_id, p.id as person_id
    from public.people p
    join public.person_customer_assignments pca on pca.person_id = p.id
    where p.active = true
      and (
        not p_hunter_scope_enabled
        or p.id = p_hunter_person_id
        or pca.customer_id = any(p_hunter_customer_ids)
      )
  )
  select json_build_object(
    'items', coalesce((
      select json_agg(row_to_json(t))
      from (
        select
          f.customer_id,
          f.customer_name,
          f.allocated_people_total as allocated_total,
          f.canonical_total_target as target_amount,
          f.person_hunter_allocated as hunter_allocated,
          f.person_farmer_allocated as delivery_farmer_allocated,
          coalesce(ps.responsible_people_count, 0) as responsible_people_count,
          coalesce(f.allocated_people_total - f.canonical_total_target, 0) as people_delta,
          case when coalesce(f.canonical_total_target, 0) > 0 then round(coalesce(f.allocated_people_total, 0) / f.canonical_total_target * 100, 2) else 0 end as achievement_percentage
        from filtered f
        left join (
          select customer_id, count(*) as responsible_people_count
          from people_scope
          group by customer_id
        ) ps on ps.customer_id = f.customer_id
        order by f.allocated_people_total desc, f.canonical_total_target desc
      ) t
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;
