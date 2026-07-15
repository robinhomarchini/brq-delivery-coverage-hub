-- Allow Hunter Especializado to behave as a normal Hunter only when the
-- Hunter target is backed by an explicit customer relationship or Studio
-- allocation. Direct person target entry remains blocked by the BFF/UI.

create or replace function public.ensure_target_allocation_assignable_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  assigned_name text;
  has_customer_hunter_relationship boolean;
  has_studio_hunter_relationship boolean;
begin
  select role_type, name
    into assigned_role, assigned_name
  from public.people
  where id = new.person_id;

  if assigned_role is null then
    raise exception 'Pessoa não encontrada para meta: %', new.person_id
      using errcode = '23503';
  end if;

  if assigned_role = 'Hunter Especializado' then
    if new.target_type <> 'hunter' then
      raise exception 'Hunter Especializado só pode receber meta Hunter derivada de Cliente ou Studio: % (%).', assigned_name, new.person_id
        using errcode = '23514';
    end if;

    select exists (
      select 1
      from public.person_customer_assignments assignment
      where assignment.person_id = new.person_id
        and assignment.customer_id = new.customer_id
    )
    into has_customer_hunter_relationship;

    select exists (
      select 1
      from public.studio_target_allocations studio
      where studio.customer_id = new.customer_id
        and studio.hunter_person_id = new.person_id
        and studio.target_year = new.target_year
        and coalesce(studio.hunter_amount, 0) > 0
    )
    into has_studio_hunter_relationship;

    if not has_customer_hunter_relationship and not has_studio_hunter_relationship then
      raise exception 'Hunter Especializado precisa estar vinculado ao cliente ou a uma meta de Studio Hunter: % (%).', assigned_name, new.person_id
        using errcode = '23514';
    end if;

    return new;
  end if;

  if assigned_role in ('Executive', 'Director', 'Staff') then
    raise exception 'Executivo, Diretor e Staff não recebem meta direta: % (%).', assigned_name, new.person_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

grant execute on function public.ensure_target_allocation_assignable_person() to authenticated;
