-- Repair AGIBANK Hunter ownership created by an old frontend/default flow.
-- AGIBANK's Hunter baseline is Eduardo Alves Leite. Ana Braz must not remain
-- as a hidden/default Hunter or manager association for this customer.

do $$
declare
  v_agibank_id text;
  v_eduardo_id text;
begin
  select id into v_agibank_id
  from public.customers
  where upper(name) = 'AGIBANK'
  limit 1;

  select id into v_eduardo_id
  from public.people
  where upper(name) = 'EDUARDO ALVES LEITE'
  order by id
  limit 1;

  if v_agibank_id is null then
    raise notice 'AGIBANK not found; no repair applied.';
    return;
  end if;

  delete from public.person_customer_assignments
  where customer_id = v_agibank_id
    and person_id = 'ana';

  delete from public.revenue_target_allocations
  where customer_id = v_agibank_id
    and person_id = 'ana'
    and target_type = 'hunter'
    and target_year = 2026;

  if v_eduardo_id is not null then
    insert into public.person_customer_assignments (person_id, customer_id, source)
    values (v_eduardo_id, v_agibank_id, 'migration_repair')
    on conflict (person_id, customer_id) do update
      set source = excluded.source;

    insert into public.revenue_target_allocations (
      id,
      customer_id,
      person_id,
      target_type,
      target_year,
      amount,
      notes
    )
    values (
      'target-' || v_agibank_id || '-' || v_eduardo_id || '-hunter-2026',
      v_agibank_id,
      v_eduardo_id,
      'hunter',
      2026,
      coalesce((
        select hunter_target
        from public.customer_target_years
        where customer_id = v_agibank_id
          and target_year = 2026
      ), (
        select hunter_target
        from public.customers
        where id = v_agibank_id
      ), 0),
      'Meta Hunter reparada a partir da validação de baseline Financial BU.'
    )
    on conflict (id) do update
      set person_id = excluded.person_id,
          amount = excluded.amount,
          notes = excluded.notes;
  else
    raise notice 'Eduardo Alves Leite not found; Ana cleanup applied but no Hunter allocation was recreated.';
  end if;
end $$;

-- Smoke test: AGIBANK must no longer point to Ana Braz and should show Eduardo
-- as the Hunter allocation when Eduardo exists in people.
select
  c.name as customer,
  p.name as person,
  p.role_type,
  a.target_type,
  a.target_year,
  a.amount
from public.revenue_target_allocations a
join public.customers c on c.id = a.customer_id
join public.people p on p.id = a.person_id
where upper(c.name) = 'AGIBANK'
order by a.target_type, p.name;
