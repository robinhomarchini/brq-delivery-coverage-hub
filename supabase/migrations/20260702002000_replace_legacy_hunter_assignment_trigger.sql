-- Replace legacy Hunter exclusivity triggers with the current active-person rule.
--
-- This migration does not delete business data. It removes an old trigger that
-- could still emit outdated messages and recreates the current trigger so only
-- active Hunter/Hunter + Farmer people block a new Hunter assignment.

drop trigger if exists person_customer_assignments_unique_hunter on public.person_customer_assignments;
drop function if exists public.assert_unique_hunter_customer_assignment();

create or replace function public.ensure_single_hunter_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  assigned_active boolean;
  conflicting_person_id text;
  conflicting_person_name text;
begin
  select role_type, active
    into assigned_role, assigned_active
  from public.people
  where id = new.person_id;

  if assigned_role not in ('Hunter', 'Hunter + Farmer') or not coalesce(assigned_active, false) then
    return new;
  end if;

  select assignment.person_id, person.name
    into conflicting_person_id, conflicting_person_name
  from public.person_customer_assignments assignment
  join public.people person on person.id = assignment.person_id
  where assignment.customer_id = new.customer_id
    and assignment.person_id <> new.person_id
    and person.active
    and person.role_type in ('Hunter', 'Hunter + Farmer')
  limit 1;

  if conflicting_person_id is not null then
    raise exception 'Cliente % já está associado a outro Hunter (% - %).',
      new.customer_id,
      conflicting_person_id,
      conflicting_person_name
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists person_customer_assignments_single_hunter on public.person_customer_assignments;
create trigger person_customer_assignments_single_hunter
  before insert or update of person_id, customer_id
  on public.person_customer_assignments
  for each row execute function public.ensure_single_hunter_assignment();

grant execute on function public.ensure_single_hunter_assignment() to authenticated;
