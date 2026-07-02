-- Production cleanup: legacy Hunter assignment dirt and duplicate customers.
--
-- Approved destructive cleanup. Every affected row is copied to
-- public.data_cleanup_audit before deletion or merge.

create table if not exists public.data_cleanup_audit (
  id bigserial primary key,
  cleanup_key text not null,
  entity text not null,
  operation text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

revoke all on public.data_cleanup_audit from anon;
grant select on public.data_cleanup_audit to authenticated;

insert into public.data_cleanup_audit(cleanup_key, entity, operation, payload)
select
  '20260702003000',
  'person_customer_assignments',
  'delete_inactive_hunter_assignment',
  to_jsonb(assignment)
from public.person_customer_assignments assignment
join public.people person on person.id = assignment.person_id
where person.role_type in ('Hunter', 'Hunter + Farmer')
  and not coalesce(person.active, false);

delete from public.person_customer_assignments assignment
using public.people person
where person.id = assignment.person_id
  and person.role_type in ('Hunter', 'Hunter + Farmer')
  and not coalesce(person.active, false);

insert into public.data_cleanup_audit(cleanup_key, entity, operation, payload)
select
  '20260702003000',
  'person_customer_assignments',
  'delete_unsupported_legacy_hunter_assignment',
  to_jsonb(assignment)
from public.person_customer_assignments assignment
join public.people person on person.id = assignment.person_id
where person.active
  and person.role_type in ('Hunter', 'Hunter + Farmer')
  and assignment.source in (
    'legacy_people_client_ids',
    'legacy_customer_manager_ids',
    'legacy_customer_primary_manager',
    'financial_source_customers',
    'migration_seed'
  )
  and not exists (
    select 1
    from public.revenue_target_allocations allocation
    where allocation.customer_id = assignment.customer_id
      and allocation.person_id = assignment.person_id
      and allocation.target_type = 'hunter'
      and allocation.amount > 0
  );

delete from public.person_customer_assignments assignment
using public.people person
where person.id = assignment.person_id
  and person.active
  and person.role_type in ('Hunter', 'Hunter + Farmer')
  and assignment.source in (
    'legacy_people_client_ids',
    'legacy_customer_manager_ids',
    'legacy_customer_primary_manager',
    'financial_source_customers',
    'migration_seed'
  )
  and not exists (
    select 1
    from public.revenue_target_allocations allocation
    where allocation.customer_id = assignment.customer_id
      and allocation.person_id = assignment.person_id
      and allocation.target_type = 'hunter'
      and allocation.amount > 0
  );

create temp table tmp_hunter_assignment_delete on commit drop as
with ranked as (
  select
    assignment.person_id,
    assignment.customer_id,
    row_number() over (
      partition by assignment.customer_id
      order by
        coalesce((
          select sum(allocation.amount)
          from public.revenue_target_allocations allocation
          where allocation.customer_id = assignment.customer_id
            and allocation.person_id = assignment.person_id
            and allocation.target_type = 'hunter'
            and allocation.amount > 0
        ), 0) desc,
        case assignment.source
          when 'rpc_target_save' then 0
          when 'rpc_person_save' then 1
          when 'app' then 2
          else 9
        end,
        assignment.updated_at desc,
        assignment.created_at desc,
        assignment.person_id
    ) as rn
  from public.person_customer_assignments assignment
  join public.people person on person.id = assignment.person_id
  where person.active
    and person.role_type in ('Hunter', 'Hunter + Farmer')
)
select person_id, customer_id
from ranked
where rn > 1;

insert into public.data_cleanup_audit(cleanup_key, entity, operation, payload)
select
  '20260702003000',
  'person_customer_assignments',
  'delete_conflicting_extra_hunter_assignment',
  to_jsonb(assignment)
from public.person_customer_assignments assignment
join tmp_hunter_assignment_delete doomed
  on doomed.person_id = assignment.person_id
 and doomed.customer_id = assignment.customer_id;

delete from public.person_customer_assignments assignment
using tmp_hunter_assignment_delete doomed
where doomed.person_id = assignment.person_id
  and doomed.customer_id = assignment.customer_id;

create temp table tmp_duplicate_customers on commit drop as
with scored as (
  select
    customer.id,
    lower(regexp_replace(trim(customer.name), '\s+', ' ', 'g')) as normalized_name,
    (
      select count(*) from public.customer_target_years target where target.customer_id = customer.id
    ) + (
      select count(*) from public.revenue_target_allocations allocation where allocation.customer_id = customer.id
    ) + (
      select count(*) from public.studio_target_allocations studio where studio.customer_id = customer.id
    ) + (
      select count(*) from public.person_customer_assignments assignment where assignment.customer_id = customer.id
    ) as fact_count,
    customer.updated_at,
    customer.created_at
  from public.customers customer
),
canonical as (
  select
    id,
    first_value(id) over (
      partition by normalized_name
      order by fact_count desc, updated_at desc, created_at desc, id
    ) as canonical_id
  from scored
)
select id as duplicate_id, canonical_id
from canonical
where id <> canonical_id;

insert into public.data_cleanup_audit(cleanup_key, entity, operation, payload)
select
  '20260702003000',
  'customers',
  'merge_duplicate_customer',
  jsonb_build_object('duplicate_id', duplicate_id, 'canonical_id', canonical_id)
from tmp_duplicate_customers;

insert into public.person_customer_assignments(person_id, customer_id, assignment_role, source, created_at, updated_at)
select assignment.person_id, duplicate.canonical_id, assignment.assignment_role, assignment.source, assignment.created_at, now()
from public.person_customer_assignments assignment
join tmp_duplicate_customers duplicate on duplicate.duplicate_id = assignment.customer_id
on conflict (person_id, customer_id) do nothing;

delete from public.person_customer_assignments assignment
using tmp_duplicate_customers duplicate
where assignment.customer_id = duplicate.duplicate_id;

insert into public.revenue_target_allocations(id, customer_id, person_id, target_type, target_year, amount, notes, created_at, updated_at)
select allocation.id || '-merged-' || duplicate.canonical_id,
       duplicate.canonical_id,
       allocation.person_id,
       allocation.target_type,
       allocation.target_year,
       allocation.amount,
       allocation.notes,
       allocation.created_at,
       now()
from public.revenue_target_allocations allocation
join tmp_duplicate_customers duplicate on duplicate.duplicate_id = allocation.customer_id
on conflict (customer_id, person_id, target_type, target_year) do update
set amount = greatest(public.revenue_target_allocations.amount, excluded.amount),
    notes = coalesce(public.revenue_target_allocations.notes, excluded.notes),
    updated_at = now();

delete from public.revenue_target_allocations allocation
using tmp_duplicate_customers duplicate
where allocation.customer_id = duplicate.duplicate_id;

insert into public.customer_target_years(customer_id, target_year, hunter_target, farmer_renewal_target, studio_hunter_target, studio_target, source_file, notes, created_at, updated_at)
select duplicate.canonical_id,
       target.target_year,
       target.hunter_target,
       target.farmer_renewal_target,
       coalesce(target.studio_hunter_target, 0),
       coalesce(target.studio_target, 0),
       target.source_file,
       target.notes,
       target.created_at,
       now()
from public.customer_target_years target
join tmp_duplicate_customers duplicate on duplicate.duplicate_id = target.customer_id
on conflict (customer_id, target_year) do update
set hunter_target = greatest(public.customer_target_years.hunter_target, excluded.hunter_target),
    farmer_renewal_target = greatest(public.customer_target_years.farmer_renewal_target, excluded.farmer_renewal_target),
    studio_hunter_target = greatest(coalesce(public.customer_target_years.studio_hunter_target, 0), excluded.studio_hunter_target),
    studio_target = greatest(coalesce(public.customer_target_years.studio_target, 0), excluded.studio_target),
    updated_at = now();

delete from public.customer_target_years target
using tmp_duplicate_customers duplicate
where target.customer_id = duplicate.duplicate_id;

insert into public.studio_target_allocations(id, customer_id, area_id, target_year, amount, hunter_amount, maintenance_amount, notes, created_at, updated_at)
select studio.id || '-merged-' || duplicate.canonical_id,
       duplicate.canonical_id,
       studio.area_id,
       studio.target_year,
       studio.amount,
       coalesce(studio.hunter_amount, 0),
       coalesce(studio.maintenance_amount, 0),
       studio.notes,
       studio.created_at,
       now()
from public.studio_target_allocations studio
join tmp_duplicate_customers duplicate on duplicate.duplicate_id = studio.customer_id
on conflict (customer_id, area_id, target_year) do update
set amount = greatest(coalesce(public.studio_target_allocations.amount, 0), excluded.amount),
    hunter_amount = greatest(coalesce(public.studio_target_allocations.hunter_amount, 0), excluded.hunter_amount),
    maintenance_amount = greatest(coalesce(public.studio_target_allocations.maintenance_amount, 0), excluded.maintenance_amount),
    notes = coalesce(public.studio_target_allocations.notes, excluded.notes),
    updated_at = now();

delete from public.studio_target_allocations studio
using tmp_duplicate_customers duplicate
where studio.customer_id = duplicate.duplicate_id;

update public.subjects subject
set customer_id = duplicate.canonical_id
from tmp_duplicate_customers duplicate
where subject.customer_id = duplicate.duplicate_id;

delete from public.customers customer
using tmp_duplicate_customers duplicate
where customer.id = duplicate.duplicate_id;

create unique index if not exists customers_normalized_name_unique_idx
  on public.customers (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

do $$
begin
  if exists (
    select 1
    from public.customers
    group by lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception 'Customer duplicate cleanup failed.';
  end if;

  if exists (
    select 1
    from public.person_customer_assignments assignment
    join public.people person on person.id = assignment.person_id
    where person.active
      and person.role_type in ('Hunter', 'Hunter + Farmer')
    group by assignment.customer_id
    having count(*) > 1
  ) then
    raise exception 'Active Hunter assignment cleanup failed.';
  end if;
end $$;
