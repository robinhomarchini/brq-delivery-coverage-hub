-- Allow customers to be saved without delivery managers.
--
-- A customer with no manager is a valid uncovered coverage state. The assistant
-- and governance views should surface it as a business pending item instead of
-- blocking the customer save or silently restoring default managers.

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
begin
  if not public.can_write_delivery_hardening() then
    raise exception 'Sem permissão para salvar cliente.'
      using errcode = '42501';
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

