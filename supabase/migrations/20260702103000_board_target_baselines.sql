-- Persist the approved Board baseline separately from editable operational
-- customer targets. Grain: customer + year + scenario.

create table if not exists public.board_target_baselines (
  id text primary key,
  baseline_year integer not null,
  scenario text not null default 'board_approved',
  customer_name text not null,
  business_unit text not null default 'BU Financial',
  hunter_target numeric(14,2) not null default 0,
  farmer_renewal_target numeric(14,2) not null default 0,
  total_target numeric(14,2) not null default 0,
  source_file text not null,
  source_customer_column text not null default 'A',
  source_hunter_column text not null default 'I',
  source_farmer_renewal_column text not null default 'L',
  source_total_column text not null default 'M',
  approved boolean not null default true,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_target_baselines_non_negative_values
    check (hunter_target >= 0 and farmer_renewal_target >= 0 and total_target >= 0),
  constraint board_target_baselines_total_reconciles
    check (abs(total_target - hunter_target - farmer_renewal_target) <= 0.02),
  constraint board_target_baselines_unique_customer_year_scenario
    unique (baseline_year, scenario, customer_name)
);

create index if not exists board_target_baselines_year_idx
  on public.board_target_baselines(baseline_year);

drop trigger if exists board_target_baselines_updated_at on public.board_target_baselines;
create trigger board_target_baselines_updated_at
before update on public.board_target_baselines
for each row execute function public.set_updated_at();

alter table public.board_target_baselines enable row level security;

revoke all on public.board_target_baselines from anon;
grant select, insert, update, delete on public.board_target_baselines to authenticated;

drop policy if exists "Active BRQ users read board baselines" on public.board_target_baselines;
create policy "Active BRQ users read board baselines"
on public.board_target_baselines
for select to authenticated
using (public.is_active_brq_user());

drop policy if exists "Admins manage board baselines" on public.board_target_baselines;
create policy "Admins manage board baselines"
on public.board_target_baselines
for all to authenticated
using (public.is_delivery_admin())
with check (public.is_delivery_admin());

insert into public.board_target_baselines (
  id,
  baseline_year,
  scenario,
  customer_name,
  business_unit,
  hunter_target,
  farmer_renewal_target,
  total_target,
  source_file,
  approved,
  approved_at
)
values
  ('board-2026-agibank', 2026, 'board_approved', 'AGIBANK', 'BU Financial', 100000.00, 0.00, 100000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-alelo', 2026, 'board_approved', 'ALELO', 'BU Financial', 11033497.05, 3177599.27, 14211096.32, 'metageralinicial.xlsx', true, now()),
  ('board-2026-asa-investments', 2026, 'board_approved', 'ASA INVESTMENTS', 'BU Financial', 200000.00, 0.00, 200000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-associacao-open-finance', 2026, 'board_approved', 'ASSOCIAÇÃO OPEN FINANCE', 'BU Financial', 928275.84, 1051917.96, 1980193.80, 'metageralinicial.xlsx', true, now()),
  ('board-2026-b3', 2026, 'board_approved', 'B3', 'BU Financial', 6675497.66, 26895615.02, 33571112.68, 'metageralinicial.xlsx', true, now()),
  ('board-2026-b3-ip', 2026, 'board_approved', 'B3 IP', 'BU Financial', 0.00, 956863.61, 956863.61, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-abc', 2026, 'board_approved', 'BANCO ABC', 'BU Financial', 0.00, 935000.00, 935000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-b3', 2026, 'board_approved', 'BANCO B3', 'BU Financial', 1200000.00, 1190613.04, 2390613.04, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-bocom', 2026, 'board_approved', 'BANCO BOCOM', 'BU Financial', 0.00, 878571.05, 878571.05, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-bs2', 2026, 'board_approved', 'BANCO BS2', 'BU Financial', 270000.00, 0.00, 270000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-itau-sa', 2026, 'board_approved', 'BANCO ITAÚ S.A.', 'BU Financial', 44089655.33, 192344140.65, 236433795.98, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-pactual', 2026, 'board_approved', 'BANCO PACTUAL', 'BU Financial', 1974000.00, 27951499.89, 29925499.89, 'metageralinicial.xlsx', true, now()),
  ('board-2026-banco-rci', 2026, 'board_approved', 'BANCO RCI', 'BU Financial', 150000.00, 0.00, 150000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-bbts', 2026, 'board_approved', 'BBTS', 'BU Financial', 400000.00, 0.00, 400000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-bradesco', 2026, 'board_approved', 'BRADESCO', 'BU Financial', 1000000.00, 0.00, 1000000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-bullla', 2026, 'board_approved', 'BULLLA', 'BU Financial', 360000.00, 0.00, 360000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-cip', 2026, 'board_approved', 'CIP', 'BU Financial', 5668109.65, 6767517.22, 12435626.87, 'metageralinicial.xlsx', true, now()),
  ('board-2026-credit-suisse', 2026, 'board_approved', 'CREDIT SUISSE', 'BU Financial', 0.00, 12025205.71, 12025205.71, 'metageralinicial.xlsx', true, now()),
  ('board-2026-crt4', 2026, 'board_approved', 'CRT4', 'BU Financial', 490066.67, 3277435.46, 3767502.13, 'metageralinicial.xlsx', true, now()),
  ('board-2026-csf', 2026, 'board_approved', 'CSF', 'BU Financial', 2347633.95, 251163.82, 2598797.77, 'metageralinicial.xlsx', true, now()),
  ('board-2026-csu', 2026, 'board_approved', 'CSU', 'BU Financial', 400000.00, 0.00, 400000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-edenred', 2026, 'board_approved', 'EDENRED', 'BU Financial', 425000.00, 0.00, 425000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-fis', 2026, 'board_approved', 'FIS', 'BU Financial', 400000.00, 0.00, 400000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-fundacao-itau', 2026, 'board_approved', 'FUNDAÇÃO ITAÚ', 'BU Financial', 0.00, 371436.39, 371436.39, 'metageralinicial.xlsx', true, now()),
  ('board-2026-intel', 2026, 'board_approved', 'INTEL', 'BU Financial', 50000.00, 0.00, 50000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-livelo-sa', 2026, 'board_approved', 'LIVELO S.A.', 'BU Financial', 0.00, 1646702.12, 1646702.12, 'metageralinicial.xlsx', true, now()),
  ('board-2026-new-logo', 2026, 'board_approved', 'NEW LOGO', 'BU Financial', 0.00, 250000.00, 250000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-opea', 2026, 'board_approved', 'OPEA', 'BU Financial', 1833333.33, 0.00, 1833333.33, 'metageralinicial.xlsx', true, now()),
  ('board-2026-picpay', 2026, 'board_approved', 'PICPAY', 'BU Financial', 1659365.03, 1225489.29, 2884854.32, 'metageralinicial.xlsx', true, now()),
  ('board-2026-pismo', 2026, 'board_approved', 'PISMO', 'BU Financial', 600000.00, 0.00, 600000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-professional-services', 2026, 'board_approved', 'PROFESSIONAL SERVICES', 'BU Financial', 1750000.00, 0.00, 1750000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-quod', 2026, 'board_approved', 'QUOD', 'BU Financial', 300000.00, 0.00, 300000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-redecard', 2026, 'board_approved', 'REDECARD', 'BU Financial', 2847489.24, 22793051.16, 25640540.40, 'metageralinicial.xlsx', true, now()),
  ('board-2026-santander', 2026, 'board_approved', 'SANTANDER', 'BU Financial', 14955000.00, 99065844.67, 114020844.67, 'metageralinicial.xlsx', true, now()),
  ('board-2026-sicoob', 2026, 'board_approved', 'SICOOB', 'BU Financial', 300000.00, 0.00, 300000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-sicredi', 2026, 'board_approved', 'SICREDI', 'BU Financial', 600000.00, 0.00, 600000.00, 'metageralinicial.xlsx', true, now()),
  ('board-2026-travelex', 2026, 'board_approved', 'TRAVELEX', 'BU Financial', 0.00, 1378530.22, 1378530.22, 'metageralinicial.xlsx', true, now()),
  ('board-2026-visa', 2026, 'board_approved', 'VISA', 'BU Financial', 5868165.97, 3376586.86, 9244752.83, 'metageralinicial.xlsx', true, now()),
  ('board-2026-votorantim', 2026, 'board_approved', 'VOTORANTIM', 'BU Financial', 800000.00, 14691912.31, 15491912.31, 'metageralinicial.xlsx', true, now()),
  ('board-2026-xp-investimentos', 2026, 'board_approved', 'XP INVESTIMENTOS', 'BU Financial', 0.00, 348590.60, 348590.60, 'metageralinicial.xlsx', true, now()),
  ('board-2026-zurich', 2026, 'board_approved', 'ZURICH', 'BU Financial', 850000.00, 4892914.06, 5742914.06, 'metageralinicial.xlsx', true, now())
on conflict (baseline_year, scenario, customer_name) do update set
  business_unit = excluded.business_unit,
  hunter_target = excluded.hunter_target,
  farmer_renewal_target = excluded.farmer_renewal_target,
  total_target = excluded.total_target,
  source_file = excluded.source_file,
  approved = excluded.approved,
  approved_at = excluded.approved_at,
  updated_at = now();

do $$
declare
  baseline_count integer;
  baseline_total numeric(14,2);
begin
  select count(*), coalesce(sum(total_target), 0)
    into baseline_count, baseline_total
  from public.board_target_baselines
  where baseline_year = 2026
    and scenario = 'board_approved'
    and approved;

  if baseline_count <> 41 then
    raise exception 'Expected 41 approved 2026 board baseline rows, found %', baseline_count;
  end if;

  if abs(baseline_total - 538269290.10) > 0.10 then
    raise exception 'Expected approved 2026 board baseline total 538269290.10, found %', baseline_total;
  end if;
end $$;
