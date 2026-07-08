-- Assign Santander direct Hunter association to Ricardo Bonatti Costa.
--
-- This is an operational correction requested by the business: Santander's
-- direct Hunter should be Bonatti. The update preserves other Hunter/Farmer
-- participants and does not transfer target or Studio values automatically.

do $$
declare
  v_customer_id text := 'client-santander';
  v_bonatti_id text;
begin
  select p.id
    into v_bonatti_id
  from public.people p
  where (
      lower(p.name) like '%ricardo%bonatti%costa%'
      or lower(p.name) like '%bonatti%costa%'
      or lower(coalesce(p.email, '')) like '%bonatti%'
    )
    and lower(p.name) not like '%bonfim%'
  order by
    case
      when lower(p.name) like '%ricardo%bonatti%costa%' then 0
      when lower(p.name) like '%bonatti%costa%' then 1
      else 2
    end,
    p.active desc,
    p.id
  limit 1;

  if v_bonatti_id is null then
    raise notice 'Ricardo Bonatti Costa person not found. Santander direct Hunter assignment was not changed.';
    return;
  end if;

  insert into public.person_customer_assignments(person_id, customer_id, assignment_role, source, created_at, updated_at)
  values (v_bonatti_id, v_customer_id, 'hunter', 'manual_santander_direct_hunter', now(), now())
  on conflict (person_id, customer_id) do update
  set assignment_role = 'hunter',
      source = 'manual_santander_direct_hunter',
      updated_at = now();
end $$;
