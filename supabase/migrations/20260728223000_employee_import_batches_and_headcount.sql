-- Persisted employee-import batches, explicit salary actions and approved direct HC.

alter table public.people
  add column if not exists imported_direct_headcount integer
    check (imported_direct_headcount is null or imported_direct_headcount >= 0),
  add column if not exists imported_direct_headcount_at timestamptz,
  add column if not exists imported_direct_headcount_source text,
  add column if not exists imported_direct_headcount_batch_id uuid;

create table if not exists public.employee_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null check (length(btrim(source_file_name)) > 0),
  storage_path text,
  preview_snapshot jsonb not null,
  status text not null default 'reconciling'
    check (status in ('reconciling', 'hc_confirmed')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.people
  drop constraint if exists people_imported_direct_headcount_batch_id_fkey;
alter table public.people
  add constraint people_imported_direct_headcount_batch_id_fkey
  foreign key (imported_direct_headcount_batch_id)
  references public.employee_import_batches(id) on delete set null;

create table if not exists public.employee_import_salary_items (
  batch_id uuid not null references public.employee_import_batches(id) on delete cascade,
  person_id text not null references public.people(id) on delete restrict,
  source_name text not null,
  proposed_salary numeric(14,2) not null check (proposed_salary > 0),
  status text not null default 'pending'
    check (status in ('pending', 'unchanged', 'updated')),
  updated_by uuid,
  updated_at timestamptz,
  primary key (batch_id, person_id)
);

create index if not exists employee_import_batches_created_at_idx
  on public.employee_import_batches(created_at desc);
create index if not exists employee_import_salary_items_person_idx
  on public.employee_import_salary_items(person_id);

drop trigger if exists employee_import_batches_updated_at on public.employee_import_batches;
create trigger employee_import_batches_updated_at
before update on public.employee_import_batches
for each row execute function public.set_updated_at();

alter table public.employee_import_batches enable row level security;
alter table public.employee_import_salary_items enable row level security;

revoke all on public.employee_import_batches from anon;
revoke all on public.employee_import_salary_items from anon;
grant select, insert, update on public.employee_import_batches to authenticated;
grant select, insert, update on public.employee_import_salary_items to authenticated;

drop policy if exists "VP admins manage employee import batches" on public.employee_import_batches;
create policy "VP admins manage employee import batches"
on public.employee_import_batches for all to authenticated
using (public.can_manage_person_compensation())
with check (public.can_manage_person_compensation());

drop policy if exists "VP admins manage employee import salary items" on public.employee_import_salary_items;
create policy "VP admins manage employee import salary items"
on public.employee_import_salary_items for all to authenticated
using (public.can_manage_person_compensation())
with check (public.can_manage_person_compensation());

drop trigger if exists employee_import_batches_audit on public.employee_import_batches;
create trigger employee_import_batches_audit
after insert or update or delete on public.employee_import_batches
for each row execute function public.audit_delivery_change();

drop trigger if exists employee_import_salary_items_audit on public.employee_import_salary_items;
create trigger employee_import_salary_items_audit
after insert or update or delete on public.employee_import_salary_items
for each row execute function public.audit_delivery_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-imports',
  'employee-imports',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "VP admins upload employee imports" on storage.objects;
create policy "VP admins upload employee imports"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-imports'
  and public.can_manage_person_compensation()
);

drop policy if exists "VP admins read employee imports" on storage.objects;
create policy "VP admins read employee imports"
on storage.objects for select to authenticated
using (
  bucket_id = 'employee-imports'
  and public.can_manage_person_compensation()
);

drop policy if exists "VP admins delete employee imports" on storage.objects;
create policy "VP admins delete employee imports"
on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-imports'
  and public.can_manage_person_compensation()
);

create or replace function public.create_employee_import_batch(
  p_batch_id uuid,
  p_source_file_name text,
  p_storage_path text,
  p_preview_snapshot jsonb,
  p_salary_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_manage_person_compensation() then
    raise exception 'employee import access denied' using errcode = '42501';
  end if;
  if p_batch_id is null
    or length(btrim(coalesce(p_source_file_name, ''))) = 0
    or length(btrim(coalesce(p_storage_path, ''))) = 0
    or coalesce(jsonb_typeof(p_preview_snapshot), 'null') <> 'object'
    or coalesce(jsonb_typeof(p_salary_items), 'null') <> 'array' then
    raise exception 'invalid employee import batch' using errcode = '22023';
  end if;

  insert into public.employee_import_batches (
    id, source_file_name, storage_path, preview_snapshot, created_by
  )
  values (
    p_batch_id,
    left(p_source_file_name, 180),
    p_storage_path,
    p_preview_snapshot,
    auth.uid()
  );

  insert into public.employee_import_salary_items (
    batch_id, person_id, source_name, proposed_salary, status
  )
  select
    p_batch_id,
    item.person_id,
    item.source_name,
    item.proposed_salary,
    item.status
  from jsonb_to_recordset(p_salary_items)
    as item(person_id text, source_name text, proposed_salary numeric, status text);

  return p_batch_id;
end;
$$;

create or replace function public.apply_employee_import_salary_item(
  p_batch_id uuid,
  p_person_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item public.employee_import_salary_items%rowtype;
begin
  if not public.can_manage_person_compensation() then
    raise exception 'employee import access denied' using errcode = '42501';
  end if;

  select * into item
  from public.employee_import_salary_items
  where batch_id = p_batch_id and person_id = p_person_id
  for update;

  if item.person_id is null then
    raise exception 'employee import salary item not found' using errcode = 'P0002';
  end if;

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
  where batch_id = p_batch_id and person_id = p_person_id;

  return jsonb_build_object(
    'person_id', p_person_id,
    'status', 'updated',
    'updated_at', now()
  );
end;
$$;

create or replace function public.confirm_employee_import_headcount(
  p_batch_id uuid,
  p_manager_mappings jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_count integer;
begin
  if not public.can_manage_person_compensation() then
    raise exception 'employee import access denied' using errcode = '42501';
  end if;
  if coalesce(jsonb_typeof(p_manager_mappings), 'null') <> 'array' then
    raise exception 'employee import mappings must be an array' using errcode = '22023';
  end if;
  if not exists (select 1 from public.employee_import_batches where id = p_batch_id) then
    raise exception 'employee import batch not found' using errcode = 'P0002';
  end if;
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
    );

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
  updated as (
    update public.people person
    set imported_direct_headcount = totals.employee_count,
        imported_direct_headcount_at = now(),
        imported_direct_headcount_source = batch.source_file_name,
        imported_direct_headcount_batch_id = p_batch_id
    from totals
    cross join public.employee_import_batches batch
    where person.id = totals.person_id
      and batch.id = p_batch_id
    returning 1
  )
  select count(*) into saved_count from updated;

  update public.employee_import_batches
  set status = 'hc_confirmed'
  where id = p_batch_id;

  return jsonb_build_object('headcounts_updated', saved_count, 'status', 'hc_confirmed');
end;
$$;

revoke all on function public.apply_employee_import_salary_item(uuid, text) from public, anon;
revoke all on function public.confirm_employee_import_headcount(uuid, jsonb) from public, anon;
revoke all on function public.create_employee_import_batch(uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.apply_employee_import_salary_item(uuid, text) to authenticated;
grant execute on function public.confirm_employee_import_headcount(uuid, jsonb) to authenticated;
grant execute on function public.create_employee_import_batch(uuid, text, text, jsonb, jsonb) to authenticated;

do $$
begin
  if to_regclass('public.employee_import_batches') is null
    or to_regclass('public.employee_import_salary_items') is null then
    raise exception 'employee import persistence tables were not created';
  end if;
  if to_regprocedure('public.apply_employee_import_salary_item(uuid,text)') is null
    or to_regprocedure('public.confirm_employee_import_headcount(uuid,jsonb)') is null
    or to_regprocedure('public.create_employee_import_batch(uuid,text,text,jsonb,jsonb)') is null then
    raise exception 'employee import action RPCs were not created';
  end if;
end $$;

notify pgrst, 'reload schema';
