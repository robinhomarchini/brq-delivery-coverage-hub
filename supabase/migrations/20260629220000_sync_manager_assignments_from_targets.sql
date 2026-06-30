-- Sync operational manager/customer assignments from Renewal + Expansion targets.
--
-- A positive farmer_renewal target for an operational manager means that manager
-- must appear as responsible for the customer. Hunter targets remain reporting
-- facts and do not create Delivery manager ownership.

delete from public.revenue_target_allocations
where target_type = 'farmer_renewal'
  and amount <= 0;

insert into public.person_customer_assignments(person_id, customer_id, source)
select distinct allocation.person_id, allocation.customer_id, 'rpc_target_save'
from public.revenue_target_allocations allocation
join public.people p on p.id = allocation.person_id
where allocation.target_type = 'farmer_renewal'
  and allocation.amount > 0
  and p.is_manager
  and p.role_type not in ('Executive', 'Director', 'Staff')
on conflict (person_id, customer_id) do nothing;

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
  person_is_manager boolean;
begin
  if not public.can_write_delivery_hardening() then
    raise exception 'Sem permissão para salvar metas.'
      using errcode = '42501';
  end if;

  if p_target_year < 2020 or p_target_year > 2100 then
    raise exception 'Ano inválido: %', p_target_year
      using errcode = '23514';
  end if;

  select role_type, is_manager
    into person_role, person_is_manager
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

    if coalesce(person_is_manager, false) then
      insert into public.person_customer_assignments(person_id, customer_id, source)
      values (p_person_id, p_customer_id, 'rpc_target_save')
      on conflict (person_id, customer_id) do update
      set source = case
            when public.person_customer_assignments.source in (
              'rpc_customer_save',
              'rpc_person_save',
              'legacy_customer_manager_ids',
              'legacy_customer_primary_manager'
            ) then public.person_customer_assignments.source
            else excluded.source
          end,
          updated_at = now();
    end if;
  else
    delete from public.revenue_target_allocations
    where customer_id = p_customer_id
      and person_id = p_person_id
      and target_type = 'farmer_renewal'
      and target_year = p_target_year;

    delete from public.person_customer_assignments
    where customer_id = p_customer_id
      and person_id = p_person_id
      and source = 'rpc_target_save';
  end if;
end;
$$;

grant execute on function public.save_person_customer_targets(
  text, text, integer, numeric, numeric, boolean, text
) to authenticated;

