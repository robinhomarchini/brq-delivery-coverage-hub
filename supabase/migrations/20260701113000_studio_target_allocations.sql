-- Store the annual composition of a customer's Áreas / Studios target.
--
-- This is intentionally separate from revenue_target_allocations because
-- studios/areas are not people.

create table if not exists public.studio_target_allocations (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  area_id text not null references public.areas(id) on delete cascade,
  target_year integer not null check (target_year between 2020 and 2100),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, area_id, target_year)
);

create index if not exists studio_target_allocations_customer_year_idx
  on public.studio_target_allocations(customer_id, target_year);

create index if not exists studio_target_allocations_area_year_idx
  on public.studio_target_allocations(area_id, target_year);

do $$
begin
  if to_regclass('public.studio_target_allocations') is not null then
    drop trigger if exists studio_target_allocations_updated_at on public.studio_target_allocations;
    create trigger studio_target_allocations_updated_at
      before update on public.studio_target_allocations
      for each row
      execute function public.set_updated_at();
  end if;
end $$;

alter table public.studio_target_allocations enable row level security;

drop policy if exists "Authenticated users read studio target allocations"
  on public.studio_target_allocations;
drop policy if exists "Authenticated users manage studio target allocations"
  on public.studio_target_allocations;

revoke all on public.studio_target_allocations from anon;
grant select, insert, update, delete on public.studio_target_allocations to authenticated;

create policy "Authenticated users read studio target allocations"
on public.studio_target_allocations
for select
to authenticated
using (true);

create policy "Authenticated users manage studio target allocations"
on public.studio_target_allocations
for all
to authenticated
using (public.can_write_delivery_hardening())
with check (public.can_write_delivery_hardening());

create or replace function public.enforce_studio_target_allocation_reconciliation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  customer_studio_target numeric(14,2);
  allocated_total numeric(14,2);
begin
  perform pg_advisory_xact_lock(hashtext(new.customer_id), new.target_year);

  select coalesce(target.studio_target, customer.studio_target, 0)
    into customer_studio_target
  from public.customers customer
  left join public.customer_target_years target
    on target.customer_id = customer.id
   and target.target_year = new.target_year
  where customer.id = new.customer_id;

  if customer_studio_target is null then
    raise exception 'Cliente não encontrado para meta de área/studio: %', new.customer_id
      using errcode = '23503';
  end if;

  select coalesce(sum(amount), 0)
    into allocated_total
  from public.studio_target_allocations
  where customer_id = new.customer_id
    and target_year = new.target_year
    and id <> new.id;

  allocated_total := coalesce(allocated_total, 0) + greatest(coalesce(new.amount, 0), 0);

  if customer_studio_target > 0 and allocated_total > customer_studio_target + 0.01 then
    raise exception 'A soma das metas de áreas/studios ultrapassa a meta de Áreas/Studios do cliente. Meta: %, soma: %',
      customer_studio_target,
      allocated_total
      using errcode = '23514';
  end if;

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
  count(*) as allocations,
  round(sum(amount), 2) as allocated_studio_target
from public.studio_target_allocations
group by target_year
order by target_year desc;
