-- Prevent direct target allocations for roles that are only consolidation/staff.
-- Renan and every Executive, Director or Staff person must never carry direct targets.

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

  if assigned_role in ('Executive', 'Director', 'Staff') then
    raise exception 'Executivo, Diretor e Staff não recebem meta direta: % (%).', assigned_name, new.person_id
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
  where role_type in ('Executive', 'Director', 'Staff')
);

do $$
begin
  if to_regclass('public.revenue_target_allocations') is not null then
    drop trigger if exists revenue_target_allocations_assignable_person_guard
      on public.revenue_target_allocations;

    create trigger revenue_target_allocations_assignable_person_guard
      before insert or update of person_id on public.revenue_target_allocations
      for each row execute function public.ensure_target_allocation_assignable_person();
  end if;
end $$;

-- Smoke-test query: should return no rows after cleanup.
select
  a.id,
  a.customer_id,
  a.person_id,
  p.name,
  p.role_type,
  a.target_type,
  a.target_year,
  a.amount
from public.revenue_target_allocations a
join public.people p on p.id = a.person_id
where p.role_type in ('Executive', 'Director', 'Staff')
order by p.role_type, p.name, a.customer_id;

