-- Allow Studio target allocations to be saved even when they exceed the
-- customer's current Studio Hunter or Studio Maintenance subtotals.
--
-- Business rule:
-- - Studio Hunter is a breakdown contained in the customer's Hunter target.
-- - Studio Maintenance/Renewal is an additive component of the customer total.
-- - Differences between allocation and customer subtotals are reconciliation
--   facts and must be shown in the UI, not hard-blocked by the database.

create or replace function public.enforce_studio_target_allocation_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_exists boolean;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(new.customer_id, '')));

  select exists (
    select 1
    from public.customers customer
    where customer.id = new.customer_id
  ) into customer_exists;

  if not customer_exists then
    raise exception 'Cliente não encontrado para meta de área/studio: %', new.customer_id
      using errcode = '23503';
  end if;

  new.hunter_amount := greatest(coalesce(new.hunter_amount, 0), 0);
  new.maintenance_amount := greatest(coalesce(new.maintenance_amount, 0), 0);

  -- Legacy compatibility: amount represents the additive maintenance component.
  -- Studio Hunter remains stored separately because it is contained in Hunter
  -- and must not be added again to total revenue.
  new.amount := new.maintenance_amount;
  return new;
end;
$$;

drop trigger if exists studio_target_allocations_reconciliation_guard
  on public.studio_target_allocations;

create trigger studio_target_allocations_reconciliation_guard
before insert or update on public.studio_target_allocations
for each row
execute function public.enforce_studio_target_allocation_reconciliation();

select
  allocation.target_year,
  round(sum(allocation.hunter_amount), 2) as allocated_studio_hunter,
  round(sum(allocation.maintenance_amount), 2) as allocated_studio_maintenance,
  count(*) as allocation_rows
from public.studio_target_allocations allocation
group by allocation.target_year
order by allocation.target_year desc;
