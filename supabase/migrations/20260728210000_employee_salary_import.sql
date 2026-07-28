-- Administrative employee salary import and persistent manager aliases.
--
-- Canonical sources remain:
--   people: identities and hierarchy
--   person_compensations: current monthly salary (legacy column name annual_salary)
-- The spreadsheet is a reviewed import proposal and is never persisted raw.

create table if not exists public.employee_import_manager_mappings (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (length(btrim(source_key)) > 0),
  source_manager_name text not null check (length(btrim(source_manager_name)) > 0),
  manager_person_id text not null references public.people(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_import_manager_mappings_manager_person_idx
  on public.employee_import_manager_mappings(manager_person_id);

drop trigger if exists employee_import_manager_mappings_updated_at
  on public.employee_import_manager_mappings;
create trigger employee_import_manager_mappings_updated_at
before update on public.employee_import_manager_mappings
for each row execute function public.set_updated_at();

alter table public.employee_import_manager_mappings enable row level security;

revoke all on public.employee_import_manager_mappings from anon;
revoke all on public.employee_import_manager_mappings from authenticated;
grant select, insert, update on public.employee_import_manager_mappings to authenticated;

drop policy if exists "VP admins read employee import manager mappings"
  on public.employee_import_manager_mappings;
drop policy if exists "VP admins manage employee import manager mappings"
  on public.employee_import_manager_mappings;

create policy "VP admins read employee import manager mappings"
on public.employee_import_manager_mappings
for select
to authenticated
using (public.can_manage_person_compensation());

create policy "VP admins manage employee import manager mappings"
on public.employee_import_manager_mappings
for all
to authenticated
using (public.can_manage_person_compensation())
with check (public.can_manage_person_compensation());

drop trigger if exists employee_import_manager_mappings_audit
  on public.employee_import_manager_mappings;
create trigger employee_import_manager_mappings_audit
after insert or update or delete on public.employee_import_manager_mappings
for each row execute function public.audit_delivery_change();

create or replace function public.apply_employee_salary_import(
  p_salary_rows jsonb,
  p_manager_mappings jsonb,
  p_effective_from date,
  p_source_file_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  salary_row_count integer;
  changed_count integer;
  mapping_count integer;
begin
  if not public.can_manage_person_compensation() then
    raise exception 'employee import access denied' using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_salary_rows), 'null') <> 'array'
    or coalesce(jsonb_typeof(p_manager_mappings), 'null') <> 'array' then
    raise exception 'employee import payload must contain arrays' using errcode = '22023';
  end if;

  if jsonb_array_length(p_salary_rows) > 5000
    or jsonb_array_length(p_manager_mappings) > 500 then
    raise exception 'employee import payload exceeds allowed size' using errcode = '54000';
  end if;

  if p_effective_from is null then
    raise exception 'effective date is required' using errcode = '23502';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_salary_rows)
      as item(person_id text, salary numeric, source_name text)
    left join public.people person on person.id = item.person_id
    where person.id is null
      or item.salary is null
      or item.salary <= 0
      or item.salary > 999999999
  ) then
    raise exception 'employee import contains an invalid person or salary' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_manager_mappings)
      as mapping(source_key text, source_name text, manager_person_id text)
    left join public.people manager on manager.id = mapping.manager_person_id
    where manager.id is null
      or not manager.active
      or not manager.is_manager
      or length(btrim(coalesce(mapping.source_key, ''))) = 0
      or length(btrim(coalesce(mapping.source_name, ''))) = 0
  ) then
    raise exception 'employee import contains an invalid manager mapping' using errcode = '23514';
  end if;

  select count(*)
    into salary_row_count
  from jsonb_to_recordset(p_salary_rows)
    as item(person_id text, salary numeric, source_name text);

  with salary_input as (
    select
      item.person_id,
      round(item.salary, 2) as salary
    from jsonb_to_recordset(p_salary_rows)
      as item(person_id text, salary numeric, source_name text)
  ),
  changed as (
    insert into public.person_compensations (
      person_id,
      annual_salary,
      currency,
      effective_from,
      notes
    )
    select
      salary_input.person_id,
      salary_input.salary,
      'BRL',
      p_effective_from,
      'Importado da planilha ' || left(coalesce(p_source_file_name, 'importacao.xlsx'), 180)
    from salary_input
    on conflict (person_id) do update
      set annual_salary = excluded.annual_salary,
          effective_from = excluded.effective_from
      where public.person_compensations.annual_salary is distinct from excluded.annual_salary
    returning 1
  )
  select count(*) into changed_count from changed;

  with mapping_input as (
    select
      btrim(mapping.source_key) as source_key,
      btrim(mapping.source_name) as source_name,
      mapping.manager_person_id
    from jsonb_to_recordset(p_manager_mappings)
      as mapping(source_key text, source_name text, manager_person_id text)
  ),
  saved as (
    insert into public.employee_import_manager_mappings (
      source_key,
      source_manager_name,
      manager_person_id,
      created_by
    )
    select
      mapping_input.source_key,
      mapping_input.source_name,
      mapping_input.manager_person_id,
      auth.uid()
    from mapping_input
    on conflict (source_key) do update
      set source_manager_name = excluded.source_manager_name,
          manager_person_id = excluded.manager_person_id
    returning 1
  )
  select count(*) into mapping_count from saved;

  return jsonb_build_object(
    'salaries_changed', changed_count,
    'salaries_unchanged', salary_row_count - changed_count,
    'manager_mappings_saved', mapping_count
  );
end;
$$;

revoke all on function public.apply_employee_salary_import(jsonb, jsonb, date, text) from public;
revoke all on function public.apply_employee_salary_import(jsonb, jsonb, date, text) from anon;
grant execute on function public.apply_employee_salary_import(jsonb, jsonb, date, text)
  to authenticated;

do $$
begin
  if to_regclass('public.employee_import_manager_mappings') is null then
    raise exception 'employee import manager mapping table was not created';
  end if;
  if to_regprocedure('public.apply_employee_salary_import(jsonb,jsonb,date,text)') is null then
    raise exception 'employee salary import RPC was not created';
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employee_import_manager_mappings'
      and policyname = 'VP admins manage employee import manager mappings'
  ) then
    raise exception 'employee import manager mapping RLS policy is missing';
  end if;
end $$;

notify pgrst, 'reload schema';
