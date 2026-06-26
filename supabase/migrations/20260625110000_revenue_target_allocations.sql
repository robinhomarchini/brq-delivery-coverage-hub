-- Editable revenue targets by customer, person, type and year.
--
-- Source of truth:
--   public.revenue_target_allocations
--
-- Imported portfolio totals in public.revenue_plans remain analytical reference
-- data. Manually editable allocations are stored only in this table.

create table if not exists public.revenue_target_allocations (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  person_id text not null references public.people(id) on delete cascade,
  target_type text not null check (target_type in ('hunter', 'farmer_renewal')),
  target_year integer not null check (target_year between 2020 and 2100),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, person_id, target_type, target_year)
);

create index if not exists revenue_target_allocations_customer_id_idx
  on public.revenue_target_allocations(customer_id);

create index if not exists revenue_target_allocations_person_id_idx
  on public.revenue_target_allocations(person_id);

create index if not exists revenue_target_allocations_type_year_idx
  on public.revenue_target_allocations(target_type, target_year);

insert into public.revenue_target_allocations
  (id, customer_id, person_id, target_type, target_year, amount, notes)
select *
from (
  values
    ('target-client-itau-bruno-farmer-renewal-2026', 'client-itau', 'bruno', 'farmer_renewal', 2026, 48178894.26::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-itau-orion-farmer-renewal-2026', 'client-itau', 'orion', 'farmer_renewal', 2026, 48178894.26::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-itau-fernanda-farmer-renewal-2026', 'client-itau', 'fernanda', 'farmer_renewal', 2026, 48178894.26::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-itau-bonfim-farmer-renewal-2026', 'client-itau', 'bonfim', 'farmer_renewal', 2026, 48178894.26::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-itau-renan-hunter-2026', 'client-itau', 'renan', 'hunter', 2026, 44089655.33::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-alelo-ana-farmer-renewal-2026', 'client-alelo', 'ana', 'farmer_renewal', 2026, 3177599.27::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-alelo-renan-hunter-2026', 'client-alelo', 'renan', 'hunter', 2026, 11033497.05::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-nuclea-ana-farmer-renewal-2026', 'client-nuclea', 'ana', 'farmer_renewal', 2026, 6767517.22::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-nuclea-renan-hunter-2026', 'client-nuclea', 'renan', 'hunter', 2026, 5668109.65::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-santander-ana-farmer-renewal-2026', 'client-santander', 'ana', 'farmer_renewal', 2026, 99065844.67::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-santander-renan-hunter-2026', 'client-santander', 'renan', 'hunter', 2026, 14955000.00::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-b3-ana-farmer-renewal-2026', 'client-b3', 'ana', 'farmer_renewal', 2026, 29043091.67::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-b3-renan-hunter-2026', 'client-b3', 'renan', 'hunter', 2026, 7875497.66::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-btg-ana-farmer-renewal-2026', 'client-btg', 'ana', 'farmer_renewal', 2026, 27951499.89::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-btg-renan-hunter-2026', 'client-btg', 'renan', 'hunter', 2026, 1974000.00::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-bv-ana-farmer-renewal-2026', 'client-bv', 'ana', 'farmer_renewal', 2026, 14691912.31::numeric, 'Carga inicial importada da planilha Financial BU.'),
    ('target-client-bv-renan-hunter-2026', 'client-bv', 'renan', 'hunter', 2026, 800000.00::numeric, 'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'),
    ('target-client-xp-ana-farmer-renewal-2026', 'client-xp', 'ana', 'farmer_renewal', 2026, 348590.60::numeric, 'Carga inicial importada da planilha Financial BU.')
) as seed(id, customer_id, person_id, target_type, target_year, amount, notes)
where exists (select 1 from public.customers c where c.id = seed.customer_id)
  and exists (select 1 from public.people p where p.id = seed.person_id)
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists revenue_target_allocations_updated_at on public.revenue_target_allocations;
    create trigger revenue_target_allocations_updated_at
      before update on public.revenue_target_allocations
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.revenue_target_allocations enable row level security;

drop policy if exists "Authenticated users read revenue target allocations" on public.revenue_target_allocations;
drop policy if exists "Authenticated users manage revenue target allocations" on public.revenue_target_allocations;

revoke all on public.revenue_target_allocations from anon;
grant select, insert, update, delete on public.revenue_target_allocations to authenticated;

create policy "Authenticated users read revenue target allocations"
on public.revenue_target_allocations
for select
to authenticated
using (auth.uid() is not null);

create policy "Authenticated users manage revenue target allocations"
on public.revenue_target_allocations
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
      and table_name = 'revenue_target_allocations'
  ) then
    raise exception 'Target allocation migration failed: table is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'revenue_target_allocations'
      and policyname = 'Authenticated users manage revenue target allocations'
  ) then
    raise exception 'Target allocation migration failed: write policy is missing';
  end if;
end $$;
