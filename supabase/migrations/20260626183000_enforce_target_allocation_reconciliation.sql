-- Enforce client/year target reconciliation for editable person allocations.
--
-- Source of truth:
--   public.revenue_target_allocations
--
-- Business rule:
--   For each Customer + Year, the sum of person allocations must not exceed
--   the customer's total target. The UI may show pending reconciliation while
--   the sum is below target, but the database blocks over-allocation.

create or replace function public.assert_target_allocation_within_customer_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_target numeric(14,2);
  allocated_total numeric(14,2);
begin
  select coalesce(c.revenue, 0)
    into customer_target
  from public.customers c
  where c.id = new.customer_id;

  if customer_target is null then
    raise exception 'Cliente não encontrado para a meta: %', new.customer_id
      using errcode = '23503';
  end if;

  select coalesce(sum(a.amount), 0)
    into allocated_total
  from public.revenue_target_allocations a
  where a.customer_id = new.customer_id
    and a.target_year = new.target_year
    and a.id <> new.id;

  allocated_total := coalesce(allocated_total, 0) + coalesce(new.amount, 0);

  if customer_target > 0 and allocated_total > customer_target + 0.01 then
    raise exception 'A soma das metas das pessoas ultrapassa a meta total do cliente. Cliente: %, Ano: %, Meta do cliente: %, Soma das pessoas: %',
      new.customer_id,
      new.target_year,
      customer_target,
      allocated_total
      using errcode = '23514';
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

-- Smoke-test query: should return no rows. If it returns rows, those customers
-- were already over-allocated before this migration and need data correction.
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
