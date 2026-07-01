-- Allow person target allocations to exceed the customer target when the user
-- explicitly chooses to keep the original customer target. The UI and reports
-- surface the over-allocation as a reconciliation issue instead of silently
-- changing the customer target or blocking the save.

create or replace function public.assert_target_allocation_within_customer_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.customers c
    where c.id = new.customer_id
  ) then
    raise exception 'Cliente não encontrado para a meta: %', new.customer_id
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists revenue_target_allocations_reconciliation_guard
  on public.revenue_target_allocations;

create trigger revenue_target_allocations_reconciliation_guard
before insert or update on public.revenue_target_allocations
for each row
execute function public.assert_target_allocation_within_customer_target();

select
  a.customer_id,
  a.target_year,
  c.revenue as customer_target,
  sum(a.amount) as allocated_total,
  sum(a.amount) - c.revenue as over_allocated_amount
from public.revenue_target_allocations a
join public.customers c on c.id = a.customer_id
group by a.customer_id, a.target_year, c.revenue
having c.revenue > 0
   and sum(a.amount) > c.revenue + 0.01
order by over_allocated_amount desc;
