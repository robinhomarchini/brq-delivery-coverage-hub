-- People e-mail is optional for organizational/contact records.
alter table public.people alter column email drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'people_email_length_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people drop constraint people_email_length_check;
  end if;

  alter table public.people add constraint people_email_length_check
    check (email is null or char_length(email) between 3 and 254);
end $$;

-- A customer can be assigned to only one Hunter profile.
-- Hunter + Farmer is treated as a Hunter-capable profile for this rule.
create or replace function public.assert_unique_hunter_customer_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  conflicting_hunter text;
begin
  select role_type
    into assigned_role
  from public.people
  where id = new.person_id;

  if assigned_role in ('Hunter', 'Hunter + Farmer') then
    select person.name
      into conflicting_hunter
    from public.person_customer_assignments assignment
    join public.people person on person.id = assignment.person_id
    where assignment.customer_id = new.customer_id
      and assignment.person_id <> new.person_id
      and person.role_type in ('Hunter', 'Hunter + Farmer')
    limit 1;

    if conflicting_hunter is not null then
      raise exception 'Cliente já associado a outro Hunter: %', conflicting_hunter;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists person_customer_assignments_unique_hunter on public.person_customer_assignments;

create trigger person_customer_assignments_unique_hunter
  before insert or update of person_id, customer_id
  on public.person_customer_assignments
  for each row
  execute function public.assert_unique_hunter_customer_assignment();

select
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'people'
  and column_name = 'email';
