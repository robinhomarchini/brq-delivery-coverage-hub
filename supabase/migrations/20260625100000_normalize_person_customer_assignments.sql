-- Normalize Person ↔ Customer coverage.
--
-- Source of truth:
--   public.person_customer_assignments
--
-- Legacy columns kept only for backward compatibility:
--   public.people.client_ids
--   public.customers.manager_responsible_id
--   public.customers.manager_responsible_ids

create table if not exists public.person_customer_assignments (
  person_id text not null references public.people(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  assignment_role text not null default 'coverage',
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (person_id, customer_id)
);

create index if not exists person_customer_assignments_person_id_idx
  on public.person_customer_assignments(person_id);

create index if not exists person_customer_assignments_customer_id_idx
  on public.person_customer_assignments(customer_id);

insert into public.person_customer_assignments(person_id, customer_id, source)
select distinct person_id, customer_id, 'legacy_people_client_ids'
from (
  select p.id as person_id, unnest(p.client_ids) as customer_id
  from public.people p
  where coalesce(array_length(p.client_ids, 1), 0) > 0
) legacy
where exists (select 1 from public.people p where p.id = legacy.person_id)
  and exists (select 1 from public.customers c where c.id = legacy.customer_id)
on conflict (person_id, customer_id) do nothing;

insert into public.person_customer_assignments(person_id, customer_id, source)
select distinct person_id, customer_id, 'legacy_customer_manager_ids'
from (
  select unnest(c.manager_responsible_ids) as person_id, c.id as customer_id
  from public.customers c
  where coalesce(array_length(c.manager_responsible_ids, 1), 0) > 0
) legacy
where exists (select 1 from public.people p where p.id = legacy.person_id)
  and exists (select 1 from public.customers c where c.id = legacy.customer_id)
on conflict (person_id, customer_id) do nothing;

insert into public.person_customer_assignments(person_id, customer_id, source)
select distinct c.manager_responsible_id, c.id, 'legacy_customer_primary_manager'
from public.customers c
where c.manager_responsible_id is not null
  and c.manager_responsible_id <> ''
  and exists (select 1 from public.people p where p.id = c.manager_responsible_id)
on conflict (person_id, customer_id) do nothing;

alter table public.customers alter column manager_responsible_id drop not null;
alter table public.customers alter column manager_responsible_ids set default '{}';
alter table public.people alter column client_ids set default '{}';

update public.people
set client_ids = '{}'
where coalesce(array_length(client_ids, 1), 0) > 0;

update public.customers
set manager_responsible_id = null,
    manager_responsible_ids = '{}'
where manager_responsible_id is not null
   or coalesce(array_length(manager_responsible_ids, 1), 0) > 0;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'person_customer_assignments_updated_at'
  ) then
    create trigger person_customer_assignments_updated_at
    before update on public.person_customer_assignments
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.person_customer_assignments enable row level security;

drop policy if exists "Authenticated users read person customer assignments" on public.person_customer_assignments;
drop policy if exists "Authenticated users manage person customer assignments" on public.person_customer_assignments;
drop policy if exists "Active BRQ users read person customer assignments" on public.person_customer_assignments;
drop policy if exists "Editors manage person customer assignments" on public.person_customer_assignments;

revoke all on public.person_customer_assignments from anon;
grant select, insert, update, delete on public.person_customer_assignments to authenticated;

create policy "Authenticated users read person customer assignments"
on public.person_customer_assignments
for select
to authenticated
using (auth.uid() is not null);

create policy "Authenticated users manage person customer assignments"
on public.person_customer_assignments
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'person_customer_assignments'
  ) then
    raise exception 'Normalization failed: person_customer_assignments table is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'person_customer_assignments'
      and policyname = 'Authenticated users manage person customer assignments'
  ) then
    raise exception 'Normalization failed: person_customer_assignments write policy is missing';
  end if;
end $$;
