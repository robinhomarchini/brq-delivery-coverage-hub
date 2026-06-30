-- Normalize customer financial targets by year.
--
-- Customer registration is not a financial fact. The canonical source for
-- customer target values is now customer_target_years keyed by
-- (customer_id, target_year). Legacy columns in customers remain only for
-- compatibility with older screens and reports during migration.

create table if not exists public.customer_target_years (
  customer_id text not null references public.customers(id) on delete cascade,
  target_year integer not null check (target_year between 2020 and 2100),
  hunter_target numeric(14,2) not null default 0 check (hunter_target >= 0),
  farmer_renewal_target numeric(14,2) not null default 0 check (farmer_renewal_target >= 0),
  revenue numeric(14,2) generated always as (hunter_target + farmer_renewal_target) stored,
  source_file text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, target_year)
);

create index if not exists customer_target_years_target_year_idx
  on public.customer_target_years(target_year);

insert into public.customer_target_years (
  customer_id,
  target_year,
  hunter_target,
  farmer_renewal_target,
  source_file,
  notes
)
select
  id,
  2026,
  coalesce(hunter_target, 0),
  coalesce(farmer_renewal_target, greatest(revenue - coalesce(hunter_target, 0), 0), 0),
  'legacy-customers',
  'Backfilled from customers compatibility columns.'
from public.customers
on conflict (customer_id, target_year) do update
set
  hunter_target = excluded.hunter_target,
  farmer_renewal_target = excluded.farmer_renewal_target,
  updated_at = now();

alter table public.customer_target_years enable row level security;

drop policy if exists "Active BRQ users read customer target years" on public.customer_target_years;
drop policy if exists "Editors manage customer target years" on public.customer_target_years;

revoke all on public.customer_target_years from anon;
grant select, insert, update, delete on public.customer_target_years to authenticated;

create policy "Active BRQ users read customer target years"
on public.customer_target_years
for select
to authenticated
using (public.is_active_brq_user());

create policy "Editors manage customer target years"
on public.customer_target_years
for all
to authenticated
using (public.can_edit_delivery_data())
with check (public.can_edit_delivery_data());

create or replace function public.touch_customer_target_years_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_target_years_touch_updated_at on public.customer_target_years;
create trigger customer_target_years_touch_updated_at
before update on public.customer_target_years
for each row
execute function public.touch_customer_target_years_updated_at();

select
  target_year,
  count(*) as customers_with_target,
  round(sum(hunter_target), 2) as hunter_target,
  round(sum(farmer_renewal_target), 2) as farmer_renewal_target,
  round(sum(revenue), 2) as revenue
from public.customer_target_years
group by target_year
order by target_year desc;
