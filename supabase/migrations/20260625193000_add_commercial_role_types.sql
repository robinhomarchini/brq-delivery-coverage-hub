-- Extend people.role_type to support commercial/reporting profiles.
-- These profiles do not automatically become Delivery managers; that remains controlled by is_manager.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'people_role_type_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people drop constraint people_role_type_check;
  end if;

  alter table public.people add constraint people_role_type_check
    check (role_type in (
      'Executive',
      'Director',
      'Farmer + Delivery',
      'Delivery',
      'Hunter',
      'Farmer',
      'Hunter + Farmer',
      'Staff'
    ));
end $$;

select conname
from pg_constraint
where conname = 'people_role_type_check'
  and conrelid = 'public.people'::regclass;
