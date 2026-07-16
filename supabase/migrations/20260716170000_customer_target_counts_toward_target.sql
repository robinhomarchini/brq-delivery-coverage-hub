-- Keep annual target participation as a customer/year fact. A customer can stay
-- visible in control screens while being excluded from the official target for
-- a specific year.

alter table public.customer_target_years
  add column if not exists counts_toward_target boolean not null default true;

alter table public.customer_target_years
  add column if not exists target_exclusion_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_target_years_target_exclusion_reason_check'
  ) then
    alter table public.customer_target_years
      add constraint customer_target_years_target_exclusion_reason_check
      check (
        target_exclusion_reason is null
        or target_exclusion_reason in ('new_customer_current_year', 'manual')
      ) not valid;
  end if;
end $$;

alter table public.customer_target_years
  validate constraint customer_target_years_target_exclusion_reason_check;

drop function if exists public.save_customer_with_managers_and_targets(
  text, text, text, text, text[], integer, numeric, numeric, numeric, numeric, numeric, numeric, boolean
);

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
begin
  if not public.can_write_delivery_hardening() then
    raise exception 'Sem permissão para salvar cliente.'
      using errcode = '42501';
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
end;
$$;

grant execute on function public.save_customer_with_managers_and_targets(
  text, text, text, text, text[], integer, numeric, numeric, numeric, numeric, numeric, numeric, boolean, boolean, text
) to authenticated;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_target_years'
      and column_name = 'counts_toward_target'
  ) then
    raise exception 'customer_target_years.counts_toward_target was not created';
  end if;
end $$;
