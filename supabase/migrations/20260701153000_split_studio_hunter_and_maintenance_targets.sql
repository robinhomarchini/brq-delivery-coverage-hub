-- Split Áreas / Studios targets into Hunter sub-targets and Maintenance/Renewal targets.
-- Studio Hunter is contained inside the customer's Hunter target and must not be
-- added again to total revenue. Studio Maintenance/Renewal remains an additive
-- target component.

alter table public.customers
  add column if not exists studio_hunter_target numeric(14,2) not null default 0;

alter table public.customer_target_years
  add column if not exists studio_hunter_target numeric(14,2) not null default 0;

alter table public.studio_target_allocations
  add column if not exists hunter_amount numeric(14,2) not null default 0,
  add column if not exists maintenance_amount numeric(14,2) not null default 0;

update public.studio_target_allocations
set maintenance_amount = coalesce(maintenance_amount, amount, 0),
    hunter_amount = coalesce(hunter_amount, 0)
where maintenance_amount = 0
  and coalesce(amount, 0) > 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_studio_hunter_target_check') then
    alter table public.customers
      add constraint customers_studio_hunter_target_check check (studio_hunter_target >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customer_target_years_studio_hunter_target_check') then
    alter table public.customer_target_years
      add constraint customer_target_years_studio_hunter_target_check check (studio_hunter_target >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'studio_target_allocations_hunter_amount_check') then
    alter table public.studio_target_allocations
      add constraint studio_target_allocations_hunter_amount_check check (hunter_amount >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'studio_target_allocations_maintenance_amount_check') then
    alter table public.studio_target_allocations
      add constraint studio_target_allocations_maintenance_amount_check check (maintenance_amount >= 0) not valid;
  end if;
end $$;

alter table public.customers validate constraint customers_studio_hunter_target_check;
alter table public.customer_target_years validate constraint customer_target_years_studio_hunter_target_check;
alter table public.studio_target_allocations validate constraint studio_target_allocations_hunter_amount_check;
alter table public.studio_target_allocations validate constraint studio_target_allocations_maintenance_amount_check;

create or replace function public.enforce_studio_target_allocation_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_studio_hunter_target numeric(14,2);
  customer_studio_maintenance_target numeric(14,2);
  allocated_hunter_total numeric(14,2);
  allocated_maintenance_total numeric(14,2);
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(new.customer_id, '')));

  select
      coalesce(target.studio_hunter_target, customer.studio_hunter_target, 0),
      coalesce(target.studio_target, customer.studio_target, 0)
    into customer_studio_hunter_target, customer_studio_maintenance_target
  from public.customers customer
  left join public.customer_target_years target
    on target.customer_id = customer.id
   and target.target_year = new.target_year
  where customer.id = new.customer_id;

  if customer_studio_hunter_target is null or customer_studio_maintenance_target is null then
    raise exception 'Cliente não encontrado para meta de área/studio: %', new.customer_id
      using errcode = '23503';
  end if;

  select
      coalesce(sum(hunter_amount), 0),
      coalesce(sum(maintenance_amount), 0)
    into allocated_hunter_total, allocated_maintenance_total
  from public.studio_target_allocations
  where customer_id = new.customer_id
    and target_year = new.target_year
    and id <> new.id;

  allocated_hunter_total := coalesce(allocated_hunter_total, 0) + greatest(coalesce(new.hunter_amount, 0), 0);
  allocated_maintenance_total := coalesce(allocated_maintenance_total, 0) + greatest(coalesce(new.maintenance_amount, 0), 0);

  if customer_studio_hunter_target > 0 and allocated_hunter_total > customer_studio_hunter_target + 0.01 then
    raise exception 'A soma Hunter das metas de áreas/studios ultrapassa a submeta Hunter do cliente. Meta: %, soma: %',
      customer_studio_hunter_target,
      allocated_hunter_total
      using errcode = '23514';
  end if;

  if customer_studio_maintenance_target > 0 and allocated_maintenance_total > customer_studio_maintenance_target + 0.01 then
    raise exception 'A soma Manutenção das metas de áreas/studios ultrapassa a meta de Manutenção do cliente. Meta: %, soma: %',
      customer_studio_maintenance_target,
      allocated_maintenance_total
      using errcode = '23514';
  end if;

  new.amount := coalesce(new.maintenance_amount, 0);
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
  target_year,
  round(sum(hunter_amount), 2) as allocated_studio_hunter,
  round(sum(maintenance_amount), 2) as allocated_studio_maintenance
from public.studio_target_allocations
group by target_year
order by target_year desc;
