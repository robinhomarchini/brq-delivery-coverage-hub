-- Architecture hardening: transactional RPCs and audit coverage for normalized tables.
--
-- This migration keeps the current homologation model working, but adds safer
-- write boundaries for the application to use when available.

create or replace function public.can_write_delivery_hardening()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean := false;
begin
  if to_regprocedure('public.can_edit_delivery_data()') is not null then
    execute 'select public.can_edit_delivery_data()' into allowed;
    if allowed then
      return true;
    end if;
  end if;

  if to_regprocedure('public.is_authenticated_brq_email()') is not null then
    execute 'select public.is_authenticated_brq_email()' into allowed;
    if allowed then
      return true;
    end if;
  end if;

  return false;
end;
$$;

grant execute on function public.can_write_delivery_hardening() to authenticated;

do $$
begin
  if to_regprocedure('public.audit_delivery_change()') is not null then
    if to_regclass('public.person_customer_assignments') is not null then
      drop trigger if exists person_customer_assignments_audit on public.person_customer_assignments;
      create trigger person_customer_assignments_audit
        after insert or update or delete on public.person_customer_assignments
        for each row execute function public.audit_delivery_change();
    end if;

    if to_regclass('public.revenue_target_allocations') is not null then
      drop trigger if exists revenue_target_allocations_audit on public.revenue_target_allocations;
      create trigger revenue_target_allocations_audit
        after insert or update or delete on public.revenue_target_allocations
        for each row execute function public.audit_delivery_change();
    end if;
  end if;
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

  if p_role_type not in ('Executive', 'Director', 'Farmer + Delivery', 'Delivery', 'Hunter', 'Farmer', 'Hunter + Farmer', 'Staff') then
    raise exception 'Tipo de atuação inválido: %', p_role_type
      using errcode = '23514';
  end if;

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

  delete from public.person_customer_assignments
  where person_id = p_id;

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

create or replace function public.save_customer_with_managers(
  p_id text,
  p_name text,
  p_industry text,
  p_director_responsible_id text,
  p_manager_responsible_ids text[],
  p_revenue numeric,
  p_margin numeric,
  p_strategic_account boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_count integer;
begin
  if not public.can_write_delivery_hardening() then
    raise exception 'Sem permissão para salvar cliente.'
      using errcode = '42501';
  end if;

  select count(*)
    into manager_count
  from (
    select distinct unnest(coalesce(p_manager_responsible_ids, '{}')) as person_id
  ) selected
  join public.people p on p.id = selected.person_id
  where p.is_manager;

  if manager_count = 0 then
    raise exception 'Selecione ao menos um manager de Delivery válido.'
      using errcode = '23514';
  end if;

  insert into public.customers (
    id,
    name,
    industry,
    director_responsible_id,
    manager_responsible_id,
    manager_responsible_ids,
    territory_id,
    revenue,
    margin,
    strategic_account
  )
  values (
    p_id,
    nullif(trim(p_name), ''),
    nullif(trim(p_industry), ''),
    p_director_responsible_id,
    null,
    '{}',
    null,
    coalesce(p_revenue, 0),
    coalesce(p_margin, 0),
    coalesce(p_strategic_account, false)
  )
  on conflict (id) do update
  set name = excluded.name,
      industry = excluded.industry,
      director_responsible_id = excluded.director_responsible_id,
      manager_responsible_id = null,
      manager_responsible_ids = '{}',
      territory_id = null,
      revenue = excluded.revenue,
      margin = excluded.margin,
      strategic_account = excluded.strategic_account,
      updated_at = now();

  delete from public.person_customer_assignments assignment
  using public.people p
  where assignment.customer_id = p_id
    and p.id = assignment.person_id
    and p.is_manager;

  insert into public.person_customer_assignments(person_id, customer_id, source)
  select selected.person_id, p_id, 'rpc_customer_save'
  from (
    select distinct unnest(coalesce(p_manager_responsible_ids, '{}')) as person_id
  ) selected
  join public.people p on p.id = selected.person_id
  where p.is_manager
  on conflict (person_id, customer_id) do update
  set source = excluded.source,
      updated_at = now();
end;
$$;

grant execute on function public.save_customer_with_managers(
  text, text, text, text, text[], numeric, numeric, boolean
) to authenticated;

create or replace function public.save_person_customer_targets(
  p_customer_id text,
  p_person_id text,
  p_target_year integer,
  p_hunter_amount numeric,
  p_farmer_renewal_amount numeric,
  p_increase_customer_target boolean default false,
  p_notes text default 'Meta associada pela tela Metas por Pessoa.'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_target numeric(14,2);
  other_people_total numeric(14,2);
  next_total numeric(14,2);
  person_role text;
begin
  if not public.can_write_delivery_hardening() then
    raise exception 'Sem permissão para salvar metas.'
      using errcode = '42501';
  end if;

  if p_target_year < 2020 or p_target_year > 2100 then
    raise exception 'Ano inválido: %', p_target_year
      using errcode = '23514';
  end if;

  select role_type
    into person_role
  from public.people
  where id = p_person_id;

  if person_role is null then
    raise exception 'Pessoa não encontrada para a meta: %', p_person_id
      using errcode = '23503';
  end if;

  if person_role in ('Executive', 'Director', 'Staff') then
    raise exception 'Executivo, Diretor e Staff não recebem meta direta.'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_customer_id), p_target_year);

  select coalesce(revenue, 0)
    into customer_target
  from public.customers
  where id = p_customer_id
  for update;

  if customer_target is null then
    raise exception 'Cliente não encontrado para a meta: %', p_customer_id
      using errcode = '23503';
  end if;

  select coalesce(sum(amount), 0)
    into other_people_total
  from public.revenue_target_allocations
  where customer_id = p_customer_id
    and target_year = p_target_year
    and person_id <> p_person_id;

  next_total := coalesce(other_people_total, 0)
    + greatest(coalesce(p_hunter_amount, 0), 0)
    + greatest(coalesce(p_farmer_renewal_amount, 0), 0);

  if customer_target > 0 and next_total > customer_target + 0.01 then
    if p_increase_customer_target then
      update public.customers
      set revenue = next_total,
          updated_at = now()
      where id = p_customer_id;
    else
      raise exception 'A soma das metas das pessoas ultrapassa a meta total do cliente. Meta do cliente: %, soma das pessoas: %',
        customer_target,
        next_total
        using errcode = '23514';
    end if;
  end if;

  if greatest(coalesce(p_hunter_amount, 0), 0) > 0 then
    insert into public.revenue_target_allocations(id, customer_id, person_id, target_type, target_year, amount, notes)
    values (
      format('target-%s-%s-hunter-%s', p_customer_id, p_person_id, p_target_year),
      p_customer_id,
      p_person_id,
      'hunter',
      p_target_year,
      greatest(coalesce(p_hunter_amount, 0), 0),
      nullif(trim(coalesce(p_notes, '')), '')
    )
    on conflict (customer_id, person_id, target_type, target_year) do update
    set amount = excluded.amount,
        notes = excluded.notes,
        updated_at = now();
  else
    delete from public.revenue_target_allocations
    where customer_id = p_customer_id
      and person_id = p_person_id
      and target_type = 'hunter'
      and target_year = p_target_year;
  end if;

  if greatest(coalesce(p_farmer_renewal_amount, 0), 0) > 0 then
    insert into public.revenue_target_allocations(id, customer_id, person_id, target_type, target_year, amount, notes)
    values (
      format('target-%s-%s-farmer-renewal-%s', p_customer_id, p_person_id, p_target_year),
      p_customer_id,
      p_person_id,
      'farmer_renewal',
      p_target_year,
      greatest(coalesce(p_farmer_renewal_amount, 0), 0),
      nullif(trim(coalesce(p_notes, '')), '')
    )
    on conflict (customer_id, person_id, target_type, target_year) do update
    set amount = excluded.amount,
        notes = excluded.notes,
        updated_at = now();
  else
    delete from public.revenue_target_allocations
    where customer_id = p_customer_id
      and person_id = p_person_id
      and target_type = 'farmer_renewal'
      and target_year = p_target_year;
  end if;
end;
$$;

grant execute on function public.save_person_customer_targets(
  text, text, integer, numeric, numeric, boolean, text
) to authenticated;

-- Smoke-test metadata: all rows below should exist after this migration.
select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'save_person_with_assignments',
    'save_customer_with_managers',
    'save_person_customer_targets',
    'can_write_delivery_hardening'
  )
order by routine_name;

select
  trigger_name,
  event_object_table
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('person_customer_assignments', 'revenue_target_allocations')
  and trigger_name in ('person_customer_assignments_audit', 'revenue_target_allocations_audit')
order by event_object_table, trigger_name;
