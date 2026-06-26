-- Staff roles do not receive direct target allocations.
-- Renan reports directly to the executive level and should not carry targets.

delete from public.revenue_target_allocations
where person_id in (
  select id
  from public.people
  where role_type in ('Executive', 'Director', 'Staff')
);

-- Smoke-test query: should return no rows.
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
