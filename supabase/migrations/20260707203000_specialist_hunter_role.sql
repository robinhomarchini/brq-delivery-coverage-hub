-- Add the cross/managerial Hunter Especializado role.
-- It has no direct own target: values are derived from Studio allocations in reports.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'people_role_type_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people drop constraint people_role_type_check;
  end if;

  alter table public.people add constraint people_role_type_check
    check (role_type in (
      'Executive',
      'Director',
      'Farmer + Delivery',
      'Delivery',
      'Hunter',
      'Hunter Especializado',
      'Farmer',
      'Hunter + Farmer',
      'Staff'
    ));
end $$;

create or replace function public.save_person_with_assignments(
  p_id text,
  p_name text,
  p_email text,
  p_job_title text,
  p_director_id text,
  p_manager_id text,
  p_role_type text,
  p_area_id text,
  p_photo_url text,
  p_notes text,
  p_active boolean,
  p_is_manager boolean,
  p_hierarchy_level integer,
  p_customer_ids text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_write_delivery_hardening() then
    raise exception 'Sem permissão para salvar pessoa.'
      using errcode = '42501';
  end if;

  if p_role_type not in ('Executive', 'Director', 'Farmer + Delivery', 'Delivery', 'Hunter', 'Hunter Especializado', 'Farmer', 'Hunter + Farmer', 'Staff') then
    raise exception 'Tipo de atuação inválido: %', p_role_type
      using errcode = '23514';
  end if;

  delete from public.person_customer_assignments
  where person_id = p_id;

  insert into public.people (
    id,
    name,
    email,
    job_title,
    director_id,
    manager_id,
    role_type,
    area_id,
    territory_ids,
    client_ids,
    photo_url,
    notes,
    active,
    is_manager,
    hierarchy_level
  )
  values (
    p_id,
    nullif(trim(p_name), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(p_job_title), ''),
    nullif(p_director_id, ''),
    nullif(p_manager_id, ''),
    p_role_type,
    nullif(p_area_id, ''),
    '{}',
    '{}',
    nullif(trim(coalesce(p_photo_url, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_active, true),
    coalesce(p_is_manager, false),
    p_hierarchy_level
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      job_title = excluded.job_title,
      director_id = excluded.director_id,
      manager_id = excluded.manager_id,
      role_type = excluded.role_type,
      area_id = excluded.area_id,
      territory_ids = '{}',
      client_ids = '{}',
      photo_url = excluded.photo_url,
      notes = excluded.notes,
      active = excluded.active,
      is_manager = excluded.is_manager,
      hierarchy_level = excluded.hierarchy_level,
      updated_at = now();

  insert into public.person_customer_assignments(person_id, customer_id, source)
  select p_id, customer_id, 'rpc_person_save'
  from (
    select distinct unnest(coalesce(p_customer_ids, '{}')) as customer_id
  ) selected
  where customer_id is not null
    and customer_id <> ''
    and exists (select 1 from public.customers c where c.id = selected.customer_id)
  on conflict (person_id, customer_id) do update
  set source = excluded.source,
      updated_at = now();
end;
$$;

grant execute on function public.save_person_with_assignments(
  text, text, text, text, text, text, text, text, text, text, boolean, boolean, integer, text[]
) to authenticated;

create or replace function public.ensure_target_allocation_assignable_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  assigned_name text;
begin
  select role_type, name
    into assigned_role, assigned_name
  from public.people
  where id = new.person_id;

  if assigned_role is null then
    raise exception 'Pessoa não encontrada para meta: %', new.person_id
      using errcode = '23503';
  end if;

  if assigned_role in ('Executive', 'Director', 'Staff', 'Hunter Especializado') then
    raise exception 'Executivo, Diretor, Staff e Hunter Especializado não recebem meta direta: % (%).', assigned_name, new.person_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

grant execute on function public.ensure_target_allocation_assignable_person() to authenticated;

delete from public.revenue_target_allocations
where person_id in (
  select id
  from public.people
  where role_type = 'Hunter Especializado'
);

select
  count(*) filter (where role_type = 'Hunter Especializado') as specialist_hunter_people,
  count(*) filter (where role_type = 'Hunter Especializado' and id in (
    select person_id from public.revenue_target_allocations
  )) as specialist_hunter_direct_targets
from public.people;
