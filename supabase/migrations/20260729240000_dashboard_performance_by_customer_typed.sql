-- Database contract hardening: typed dashboard performance RPC
--
-- Replaces the legacy JSON contract of get_dashboard_performance_by_customer
-- with an explicit RETURNS TABLE so generated Supabase types and the
-- repository adapter can consume a stable, typed row shape instead of
-- casting json_build_object payloads.

create or replace function public.get_dashboard_performance_by_customer_v2(
  p_target_year integer default 2026,
  p_include_new_logos boolean default false,
  p_hunter_scope_enabled boolean default false,
  p_hunter_customer_ids text[] default '{}',
  p_hunter_person_id text default null
)
returns table (
  customer_id text,
  customer_name text,
  target_amount numeric,
  allocated_total numeric,
  hunter_allocated numeric,
  delivery_farmer_allocated numeric,
  responsible_people_count bigint,
  people_delta numeric,
  achievement_percentage numeric
)
language sql
security invoker
set search_path = public
as $$
  with filtered as (
    select
      v.customer_id,
      v.customer_name,
      v.canonical_total_target,
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
  select
    f.customer_id,
    f.customer_name,
    coalesce(f.canonical_total_target, 0) as target_amount,
    coalesce(f.allocated_people_total, 0) as allocated_total,
    coalesce(f.person_hunter_allocated, 0) as hunter_allocated,
    coalesce(f.person_farmer_allocated, 0) as delivery_farmer_allocated,
    0 as responsible_people_count,
    coalesce(f.allocated_people_total - f.canonical_total_target, 0) as people_delta,
    case when coalesce(f.canonical_total_target, 0) > 0 then round(coalesce(f.allocated_people_total, 0) / f.canonical_total_target * 100, 2) else 0 end as achievement_percentage
  from filtered f;
$$;
