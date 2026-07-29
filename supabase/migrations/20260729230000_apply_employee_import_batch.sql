-- Employee import: atomic apply-all RPC (simplified)
--
-- Minimal version to isolate deployment failure.
-- Applies salary and headcount in one transaction.

create or replace function public.apply_employee_import_batch(
  p_batch_id uuid,
  p_manager_mappings jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  batch public.employee_import_batches%rowtype;
  item public.employee_import_salary_items%rowtype;
  saved_count integer := 0;
  updated_salaries integer := 0;
begin
  if not public.can_manage_person_compensation() then
    raise exception 'employee import access denied' using errcode = '42501';
  end if;
  if p_batch_id is null then
    raise exception 'employee import batch id is required' using errcode = '22023';
  end if;

  select * into batch
  from public.employee_import_batches
  where id = p_batch_id
  for update;

  if batch.id is null then
    raise exception 'employee import batch not found' using errcode = 'P0002';
  end if;

  if batch.status = 'hc_confirmed' then
    return jsonb_build_object(
      'headcounts_updated', 0,
      'status', 'hc_confirmed',
      'salaries_updated', 0
    );
  end if;

  for item in
    select *
    from public.employee_import_salary_items
    where batch_id = p_batch_id
      and status in ('pending', 'updated')
    for update
  loop
    insert into public.person_compensations (
      person_id, annual_salary, currency, effective_from, notes
    )
    values (
      item.person_id,
      item.proposed_salary,
      'BRL',
      current_date,
      'Importacao de funcionarios - lote ' || p_batch_id::text
    )
    on conflict (person_id) do update
      set annual_salary = excluded.annual_salary,
          effective_from = excluded.effective_from,
          notes = excluded.notes;

    update public.employee_import_salary_items
    set status = 'updated',
        updated_by = auth.uid(),
        updated_at = now()
    where batch_id = p_batch_id
      and person_id = item.person_id;

    updated_salaries := updated_salaries + 1;
  end loop;

  if coalesce(jsonb_typeof(p_manager_mappings), 'null') = 'array' then
    if exists (
      select 1
      from jsonb_to_recordset(p_manager_mappings)
        as mapping(source_key text, source_name text, person_id text, employee_count integer)
      left join public.people person on person.id = mapping.person_id
      where person.id is null
        or mapping.employee_count < 0
        or length(btrim(coalesce(mapping.source_key, ''))) = 0
    ) then
      raise exception 'employee import contains an invalid headcount mapping' using errcode = '23514';
    end if;

    with mapping_input as (
      select *
      from jsonb_to_recordset(p_manager_mappings)
        as mapping(source_key text, source_name text, person_id text, employee_count integer)
    )
    insert into public.employee_import_manager_mappings (
      source_key, source_manager_name, manager_person_id, created_by
    )
    select source_key, source_name, person_id, auth.uid()
    from mapping_input
    on conflict (source_key) do update
      set source_manager_name = excluded.source_manager_name,
          manager_person_id = excluded.manager_person_id;

    with totals as (
      select person_id, sum(employee_count)::integer as employee_count
      from jsonb_to_recordset(p_manager_mappings)
        as mapping(source_key text, source_name text, person_id text, employee_count integer)
      group by person_id
    ),
    cleared as (
      update public.people person
      set imported_direct_headcount = null,
          imported_direct_headcount_at = null,
          imported_direct_headcount_source = null,
          imported_direct_headcount_batch_id = null
      where person.imported_direct_headcount is not null
        and not exists (
          select 1
          from jsonb_to_recordset(p_manager_mappings)
            as mapping(source_key text, source_name text, person_id text, employee_count integer)
          where mapping.person_id = person.id
        )
    ),
    updated as (
      update public.people person
      set imported_direct_headcount = totals.employee_count,
          imported_direct_headcount_at = now(),
          imported_direct_headcount_source = batch.source_file_name,
          imported_direct_headcount_batch_id = p_batch_id
      from totals
      where person.id = totals.person_id
      returning 1
    )
    select count(*) into saved_count from updated;
  else
    update public.people person
    set imported_direct_headcount = null,
        imported_direct_headcount_at = null,
        imported_direct_headcount_source = null,
        imported_direct_headcount_batch_id = null
    where person.imported_direct_headcount_batch_id = p_batch_id;

    select count(*) into saved_count
    from public.people
    where imported_direct_headcount_batch_id = p_batch_id;
  end if;

  update public.employee_import_batches
  set status = 'hc_confirmed',
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'headcounts_updated', coalesce(saved_count, 0),
    'status', 'hc_confirmed',
    'salaries_updated', updated_salaries
  );
end;
$$;

revoke all on function public.apply_employee_import_batch(uuid, jsonb) from public, anon;
grant execute on function public.apply_employee_import_batch(uuid, jsonb) to authenticated;
