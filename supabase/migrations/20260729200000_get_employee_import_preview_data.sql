-- Performance: consolidate employee import preview reads
--
-- buildEmployeeImportPreview() currently fetches all people, all compensations,
-- and all manager mappings as separate queries. This RPC consolidates those
-- reads and also returns basic diagnostics, so the import preview can keep
-- working even if one of the sources is temporarily empty.

create or replace function public.get_employee_import_preview_data()
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'people', coalesce((
      select json_agg(row_to_json(t))
      from (
        select id, name, active, is_manager
        from public.people
        order by name
        limit 50000
      ) t
    ), '[]'::json),
    'compensations', coalesce((
      select json_agg(row_to_json(t))
      from (
        select person_id, annual_salary
        from public.person_compensations
        limit 50000
      ) t
    ), '[]'::json),
    'managerMappings', coalesce((
      select json_agg(row_to_json(t))
      from (
        select source_key, source_manager_name, manager_person_id
        from public.employee_import_manager_mappings
        limit 500
      ) t
    ), '[]'::json),
    'compensationSourceEmpty', not exists (select 1 from public.person_compensations limit 1)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_employee_import_preview_data() to authenticated;

comment on function public.get_employee_import_preview_data() is 'Returns lightweight lookup data for employee import preview matching. SECURITY INVOKER keeps existing RLS on source tables.';
