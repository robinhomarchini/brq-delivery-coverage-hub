-- Allow Consulta Hunter to operate inside its own business scope without
-- broadening editor/admin permissions. UI filters remain convenience only;
-- these helpers and policies are the security boundary.

create or replace function public.current_hunter_access_person_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.app_users u
  join public.people p
    on lower(p.email) = lower(u.email)
  where (
      u.user_id = auth.uid()
      or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and u.active
    and u.role = 'hunter_viewer'
    and p.active
    and p.role_type in ('Hunter', 'Hunter + Farmer', 'Hunter Especializado')
  limit 1
$$;

grant execute on function public.current_hunter_access_person_id() to authenticated;

create or replace function public.can_hunter_scope_write_for_person(p_person_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_hunter_access_person_id() is not null
    and public.current_hunter_access_person_id() = p_person_id
$$;

grant execute on function public.can_hunter_scope_write_for_person(text) to authenticated;

create or replace function public.can_hunter_scope_write_studio(
  p_hunter_person_id text,
  p_maintenance_person_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_hunter_access_person_id() is not null
    and (
      nullif(p_hunter_person_id, '') is null
      or nullif(p_hunter_person_id, '') = public.current_hunter_access_person_id()
    )
    and (
      nullif(p_maintenance_person_id, '') is null
      or nullif(p_maintenance_person_id, '') = public.current_hunter_access_person_id()
    )
    and (
      nullif(p_hunter_person_id, '') = public.current_hunter_access_person_id()
      or nullif(p_maintenance_person_id, '') = public.current_hunter_access_person_id()
    )
$$;

grant execute on function public.can_hunter_scope_write_studio(text, text) to authenticated;

drop policy if exists "Hunter viewers update own person" on public.people;
create policy "Hunter viewers update own person"
on public.people
for update
to authenticated
using (public.can_hunter_scope_write_for_person(id))
with check (public.can_hunter_scope_write_for_person(id));

drop policy if exists "Hunter viewers manage own customer assignments" on public.person_customer_assignments;
create policy "Hunter viewers manage own customer assignments"
on public.person_customer_assignments
for all
to authenticated
using (public.can_hunter_scope_write_for_person(person_id))
with check (public.can_hunter_scope_write_for_person(person_id));

drop policy if exists "Hunter viewers manage own revenue target allocations" on public.revenue_target_allocations;
create policy "Hunter viewers manage own revenue target allocations"
on public.revenue_target_allocations
for all
to authenticated
using (public.can_hunter_scope_write_for_person(person_id))
with check (public.can_hunter_scope_write_for_person(person_id));

drop policy if exists "Hunter viewers manage own studio target allocations" on public.studio_target_allocations;
create policy "Hunter viewers manage own studio target allocations"
on public.studio_target_allocations
for all
to authenticated
using (public.can_hunter_scope_write_studio(hunter_person_id, maintenance_person_id))
with check (public.can_hunter_scope_write_studio(hunter_person_id, maintenance_person_id));

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
declare
  v_can_edit boolean := public.can_write_delivery_hardening();
  v_hunter_person_id text := public.current_hunter_access_person_id();
begin
  if p_role_type not in ('Executive', 'Director', 'Farmer + Delivery', 'Delivery', 'Hunter', 'Hunter Especializado', 'Farmer', 'Hunter + Farmer', 'Staff') then
    raise exception 'Tipo de atuação inválido: %', p_role_type
      using errcode = '23514';
  end if;

  if not v_can_edit then
    if v_hunter_person_id is null or v_hunter_person_id <> p_id then
      raise exception 'Consulta Hunter só pode salvar a própria pessoa.'
        using errcode = '42501';
    end if;

    update public.people
    set name = nullif(trim(p_name), ''),
        email = nullif(trim(coalesce(p_email, '')), ''),
        job_title = nullif(trim(p_job_title), ''),
        photo_url = nullif(trim(coalesce(p_photo_url, '')), ''),
        notes = nullif(trim(coalesce(p_notes, '')), ''),
        updated_at = now()
    where id = p_id;

    if not found then
      raise exception 'Pessoa não encontrada para atualização Hunter: %', p_id
        using errcode = '23503';
    end if;

    return;
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

create or replace function public.save_customer_with_managers_and_targets(
  p_id text,
  p_name text,
  p_industry text,
  p_director_responsible_id text,
  p_manager_responsible_ids text[],
  p_target_year integer,
  p_hunter_target numeric,
  p_farmer_renewal_target numeric,
  p_studio_hunter_target numeric,
  p_studio_target numeric,
  p_revenue numeric,
  p_margin numeric,
  p_strategic_account boolean,
  p_counts_toward_target boolean default true,
  p_target_exclusion_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_edit boolean := public.can_write_delivery_hardening();
  v_hunter_person_id text := public.current_hunter_access_person_id();
  v_existing_customer boolean;
begin
  select exists (
    select 1 from public.customers c where c.id = p_id
  ) into v_existing_customer;

  if not v_can_edit then
    if v_hunter_person_id is null then
      raise exception 'Sem permissão para salvar cliente.'
        using errcode = '42501';
    end if;

    if v_existing_customer then
      raise exception 'Consulta Hunter só pode criar novos clientes.'
        using errcode = '42501';
    end if;

    if coalesce(array_length(p_manager_responsible_ids, 1), 0) > 0 then
      raise exception 'Consulta Hunter não pode definir Farmers/Delivery no cadastro do cliente.'
        using errcode = '42501';
    end if;
  end if;

  if coalesce(p_counts_toward_target, true)
    and p_target_exclusion_reason is not null then
    raise exception 'Motivo de exclusão só pode ser informado quando o cliente estiver fora da meta.'
      using errcode = '22023';
  end if;

  if p_target_exclusion_reason is not null
    and p_target_exclusion_reason not in ('new_customer_current_year', 'manual') then
    raise exception 'Motivo de exclusão de meta inválido.'
      using errcode = '22023';
  end if;

  insert into public.customers (
    id,
    name,
    industry,
    director_responsible_id,
    manager_responsible_id,
    manager_responsible_ids,
    territory_id,
    hunter_target,
    farmer_renewal_target,
    studio_hunter_target,
    studio_target,
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
    greatest(coalesce(p_hunter_target, 0), 0),
    greatest(coalesce(p_farmer_renewal_target, 0), 0),
    greatest(coalesce(p_studio_hunter_target, 0), 0),
    greatest(coalesce(p_studio_target, 0), 0),
    coalesce(
      p_revenue,
      greatest(coalesce(p_hunter_target, 0), 0)
        + greatest(coalesce(p_farmer_renewal_target, 0), 0)
    ),
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
      hunter_target = excluded.hunter_target,
      farmer_renewal_target = excluded.farmer_renewal_target,
      studio_hunter_target = excluded.studio_hunter_target,
      studio_target = excluded.studio_target,
      revenue = excluded.revenue,
      margin = excluded.margin,
      strategic_account = excluded.strategic_account,
      updated_at = now();

  insert into public.customer_target_years (
    customer_id,
    target_year,
    hunter_target,
    farmer_renewal_target,
    studio_hunter_target,
    studio_target,
    counts_toward_target,
    target_exclusion_reason,
    notes
  )
  values (
    p_id,
    p_target_year,
    greatest(coalesce(p_hunter_target, 0), 0),
    greatest(coalesce(p_farmer_renewal_target, 0), 0),
    greatest(coalesce(p_studio_hunter_target, 0), 0),
    greatest(coalesce(p_studio_target, 0), 0),
    coalesce(p_counts_toward_target, true),
    case when coalesce(p_counts_toward_target, true) then null else coalesce(p_target_exclusion_reason, 'manual') end,
    'Saved by transactional customer command.'
  )
  on conflict (customer_id, target_year) do update
  set hunter_target = excluded.hunter_target,
      farmer_renewal_target = excluded.farmer_renewal_target,
      studio_hunter_target = excluded.studio_hunter_target,
      studio_target = excluded.studio_target,
      counts_toward_target = excluded.counts_toward_target,
      target_exclusion_reason = excluded.target_exclusion_reason,
      notes = excluded.notes,
      updated_at = now();

  delete from public.revenue_target_allocations allocation
  using public.people p
  where allocation.customer_id = p_id
    and allocation.target_type = 'farmer_renewal'
    and p.id = allocation.person_id
    and (
      (p.is_manager and p.role_type not in ('Executive', 'Director', 'Staff'))
      or p.role_type in ('Farmer + Delivery', 'Delivery', 'Farmer', 'Hunter + Farmer')
    )
    and not exists (
      select 1
      from (
        select distinct unnest(coalesce(p_manager_responsible_ids, '{}')) as person_id
      ) selected
      where selected.person_id = allocation.person_id
    );

  delete from public.person_customer_assignments assignment
  using public.people p
  where assignment.customer_id = p_id
    and p.id = assignment.person_id
    and (
      (p.is_manager and p.role_type not in ('Executive', 'Director', 'Staff'))
      or p.role_type in ('Farmer + Delivery', 'Delivery', 'Farmer', 'Hunter + Farmer')
    );

  insert into public.person_customer_assignments(person_id, customer_id, source)
  select selected.person_id, p_id, 'rpc_customer_save'
  from (
    select distinct unnest(coalesce(p_manager_responsible_ids, '{}')) as person_id
  ) selected
  join public.people p on p.id = selected.person_id
  where p.active
    and (
      (p.is_manager and p.role_type not in ('Executive', 'Director', 'Staff'))
      or p.role_type in ('Farmer + Delivery', 'Delivery', 'Farmer', 'Hunter + Farmer')
    )
  on conflict (person_id, customer_id) do update
  set source = excluded.source,
      updated_at = now();

  if not v_can_edit then
    insert into public.person_customer_assignments(person_id, customer_id, source)
    values (v_hunter_person_id, p_id, 'rpc_hunter_customer_create')
    on conflict (person_id, customer_id) do update
    set source = excluded.source,
        updated_at = now();
  end if;
end;
$$;

grant execute on function public.save_customer_with_managers_and_targets(
  text, text, text, text, text[], integer, numeric, numeric, numeric, numeric, numeric, numeric, boolean, boolean, text
) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_target_allocations'
      and policyname = 'Hunter viewers manage own studio target allocations'
  ) then
    raise exception 'Hunter scoped RLS failed: studio allocation policy missing';
  end if;
end $$;
