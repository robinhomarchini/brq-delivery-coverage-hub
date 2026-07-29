-- Performance: consolidate delivery catalog reads
--
-- Replaces the 14+ parallel .from().select("*") queries currently used by
-- SupabaseDeliveryRepository.fetchAll() with one server-side function. This
-- is invoked after every mutation, so it has the highest read-volume in the
-- repository layer.

create or replace function public.get_full_delivery_data()
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'areas', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.areas
        order by name
      ) t
    ), '[]'::json),
    'people', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.people
        order by hierarchy_level, name
      ) t
    ), '[]'::json),
    'personCompensations', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.person_compensations
        order by person_id
      ) t
    ), '[]'::json),
    'customers', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.customers
        order by name
      ) t
    ), '[]'::json),
    'customerTargets', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.customer_target_years
        order by target_year desc, customer_id
      ) t
    ), '[]'::json),
    'subjects', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.subjects
        order by name
      ) t
    ), '[]'::json),
    'assignments', coalesce((
      select json_agg(row_to_json(t))
      from (
        select person_id, customer_id
        from public.person_customer_assignments
      ) t
    ), '[]'::json),
    'targetAllocations', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.revenue_target_allocations
        order by target_year desc, customer_id
      ) t
    ), '[]'::json),
    'studioTargetAllocations', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.studio_target_allocations
        order by target_year desc, customer_id
      ) t
    ), '[]'::json),
    'specialistHunterStudioAssignments', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.specialist_hunter_studio_assignments
        order by target_year desc, person_id
      ) t
    ), '[]'::json),
    'territoryRefs', coalesce((
      select json_agg(row_to_json(t))
      from (
        select id, area_id
        from public.territories
      ) t
    ), '[]'::json),
    'boardTargetBaselines', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.board_target_baselines
        where approved = true
        order by baseline_year desc, customer_name
      ) t
    ), '[]'::json),
    'studioBaselineSnapshots', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.studio_baseline_snapshots
        order by created_at desc
        limit 20
      ) t
    ), '[]'::json),
    'targetBaselineSnapshots', coalesce((
      select json_agg(row_to_json(t))
      from (
        select *
        from public.target_baseline_snapshots
        order by created_at desc
        limit 20
      ) t
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_full_delivery_data() to authenticated;

comment on function public.get_full_delivery_data() is 'Returns consolidated delivery read model for the repository hydration path. SECURITY INVOKER keeps existing RLS on source tables.';
