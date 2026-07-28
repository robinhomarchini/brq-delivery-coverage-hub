-- Harden the Consulta Hunter customer-create boundary.
--
-- This migration keeps the approved behavior: Hunter scoped users may create a
-- new customer in their own consultation flow, but must not update existing
-- customers or assign Farmers/Delivery through the customer command. The rule is
-- now an explicit database authorization helper used by the transactional RPC.

create or replace function public.can_hunter_scope_create_customer(
  p_customer_id text,
  p_manager_responsible_ids text[] default '{}'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_hunter_access_person_id() is not null
    and nullif(trim(coalesce(p_customer_id, '')), '') is not null
    and coalesce(array_length(p_manager_responsible_ids, 1), 0) = 0
    and not exists (
      select 1
      from public.customers c
      where c.id = p_customer_id
    )
$$;

grant execute on function public.can_hunter_scope_create_customer(text, text[]) to authenticated;

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
  v_hunter_scoped_create boolean;
begin
  select exists (
    select 1 from public.customers c where c.id = p_id
  ) into v_existing_customer;

  v_hunter_scoped_create := public.can_hunter_scope_create_customer(p_id, p_manager_responsible_ids);

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

    if not v_hunter_scoped_create then
      raise exception 'Consulta Hunter só pode criar novos clientes sem Farmers/Delivery.'
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
      updated_at = now()
  where v_can_edit;

  if not found then
    raise exception 'Consulta Hunter só pode criar novos clientes.'
      using errcode = '42501';
  end if;

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
      updated_at = now()
  where v_can_edit;

  if not found then
    raise exception 'Consulta Hunter só pode criar novos clientes.'
      using errcode = '42501';
  end if;

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

  if v_hunter_scoped_create then
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
  if to_regprocedure('public.can_hunter_scope_create_customer(text,text[])') is null then
    raise exception 'Hunter scoped customer-create hardening failed: authorization helper missing';
  end if;
end $$;
