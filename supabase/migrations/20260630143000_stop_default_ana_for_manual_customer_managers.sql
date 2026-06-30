-- Stop stale default manager assignments from overriding manual customer coverage.
--
-- Customer-manager ownership is normalized in person_customer_assignments.
-- The legacy customers.manager_responsible_ids field is kept synchronized for
-- compatibility, but must not keep Ana Braz as a default when the user manually
-- assigns another operational manager.

update public.people
set
  role_type = 'Farmer + Delivery',
  is_manager = true,
  manager_id = 'ane',
  area_id = 'area-financial',
  hierarchy_level = 3,
  updated_at = now()
where id = 'andreia';

delete from public.revenue_target_allocations allocation
using public.customers customer
where allocation.customer_id = customer.id
  and customer.name = 'CREDIT SUISSE'
  and allocation.person_id = 'ana'
  and allocation.target_type = 'farmer_renewal'
  and exists (
    select 1
    from public.person_customer_assignments assignment
    where assignment.customer_id = customer.id
      and assignment.person_id = 'andreia'
  );

delete from public.person_customer_assignments assignment
using public.customers customer
where assignment.customer_id = customer.id
  and customer.name = 'CREDIT SUISSE'
  and assignment.person_id = 'ana'
  and exists (
    select 1
    from public.person_customer_assignments andreia_assignment
    where andreia_assignment.customer_id = customer.id
      and andreia_assignment.person_id = 'andreia'
  );

with customer_managers as (
  select
    assignment.customer_id,
    array_agg(assignment.person_id order by person.name) as manager_ids
  from public.person_customer_assignments assignment
  join public.people person on person.id = assignment.person_id
  where person.active
    and person.is_manager
  group by assignment.customer_id
)
update public.customers customer
set
  manager_responsible_ids = coalesce(customer_managers.manager_ids, '{}'),
  manager_responsible_id = (coalesce(customer_managers.manager_ids, '{}'))[1],
  updated_at = now()
from customer_managers
where customer.id = customer_managers.customer_id;

update public.customers customer
set
  manager_responsible_ids = '{}',
  manager_responsible_id = null,
  updated_at = now()
where not exists (
  select 1
  from public.person_customer_assignments assignment
  join public.people person on person.id = assignment.person_id
  where assignment.customer_id = customer.id
    and person.active
    and person.is_manager
);

select
  c.name,
  c.manager_responsible_ids,
  coalesce(json_agg(p.name order by p.name) filter (where p.id is not null), '[]'::json) as normalized_managers
from public.customers c
left join public.person_customer_assignments a on a.customer_id = c.id
left join public.people p on p.id = a.person_id and p.active and p.is_manager
where c.name = 'CREDIT SUISSE'
group by c.name, c.manager_responsible_ids;
