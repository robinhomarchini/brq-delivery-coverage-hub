create table if not exists public.portfolio_directors (
  id text primary key,
  name text not null,
  job_title text not null
);

create table if not exists public.portfolio_delivery_managers (
  id text primary key,
  name text not null,
  director_id text not null references public.portfolio_directors(id) on delete restrict
);

create table if not exists public.revenue_plans (
  id text primary key,
  customer_name text not null,
  customer_cluster text not null,
  industry text not null,
  director_id text not null references public.portfolio_directors(id) on delete restrict,
  manager_ids text[] not null default '{}',
  revenue_current numeric(14,2) not null default 0,
  revenue_target numeric(14,2) not null default 0,
  renewal_revenue numeric(14,2) not null default 0,
  expansion_revenue numeric(14,2) not null default 0,
  new_business_revenue numeric(14,2) not null default 0,
  source_customer_names text[] not null default '{}',
  source_file text not null default 'Curva de Vendas Revisada (1).xlsx',
  imported_at date not null default date '2026-06-24',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists revenue_plans_director_id_idx on public.revenue_plans(director_id);
create index if not exists revenue_plans_manager_ids_idx on public.revenue_plans using gin(manager_ids);
create index if not exists revenue_plans_customer_cluster_idx on public.revenue_plans(customer_cluster);

insert into public.portfolio_directors (id, name, job_title) values
  ('ca', 'CA', 'Diretor de Delivery'),
  ('ane', 'Ane Knust', 'Diretora de Delivery')
on conflict (id) do update set name = excluded.name, job_title = excluded.job_title;

insert into public.portfolio_delivery_managers (id, name, director_id) values
  ('bruno', 'Bruno', 'ca'),
  ('orion', 'Orion', 'ca'),
  ('fernanda', 'Fernanda', 'ca'),
  ('bonfim', 'Ricardo Bonfim', 'ca'),
  ('ana', 'Ana Braz', 'ane')
on conflict (id) do update set name = excluded.name, director_id = excluded.director_id;

insert into public.revenue_plans (id, customer_name, customer_cluster, industry, director_id, manager_ids, revenue_current, revenue_target, renewal_revenue, expansion_revenue, new_business_revenue, source_customer_names) values
  ('portfolio-itau', 'Itaú', 'Itaú', 'Financial Services', 'ca', array['bruno','orion','fernanda','bonfim'], 195695559.03, 237005232.37, 190997298.93, 0.00, 67807933.43, array['BANCO ITAÚ S.A.','FUNDAÇÃO ITAÚ']),
  ('portfolio-santander', 'Santander', 'Santander', 'Financial Services', 'ane', array['ana'], 96001544.74, 114020844.67, 82685844.67, 0.00, 34895000.00, array['SANTANDER']),
  ('portfolio-b3', 'B3', 'B3', 'Financial Services', 'ane', array['ana'], 16200000.49, 36918589.33, 25668788.54, 0.00, 12049800.79, array['B3','B3 IP','BANCO B3']),
  ('portfolio-btg', 'BTG', 'BTG', 'Financial Services', 'ane', array['ana'], 0.00, 29925499.89, 20973814.71, 0.00, 9551685.18, array['BANCO PACTUAL']),
  ('portfolio-redecard', 'Redecard', 'Redecard', 'Financial Services', 'ane', array['ana'], 25043493.22, 25640540.40, 21352124.12, 0.00, 4288416.27, array['REDECARD']),
  ('portfolio-bv', 'BV', 'BV', 'Financial Services', 'ane', array['ana'], 27906267.39, 15491912.31, 15391912.31, 0.00, 900000.00, array['VOTORANTIM']),
  ('portfolio-alelo', 'Alelo', 'Alelo', 'Financial Services', 'ca', array['ana'], 0.00, 14511096.32, 2431414.39, 0.00, 12179681.94, array['ALELO']),
  ('portfolio-nuclea', 'Núclea', 'Núclea', 'Financial Services', 'ca', array['ana'], 0.00, 12435626.88, 5932081.91, 0.00, 8903544.97, array['CIP']),
  ('portfolio-credit-suisse', 'Credit Suisse', 'Credit Suisse', 'Financial Services', 'ane', array['ana'], 10405485.59, 12025205.71, 9309378.57, 0.00, 2715827.14, array['CREDIT SUISSE']),
  ('portfolio-visa', 'Visa', 'Visa', 'Financial Services', 'ane', array['ana'], 0.00, 9244752.82, 3376586.86, 0.00, 5868165.97, array['VISA']),
  ('portfolio-zurich', 'Zurich', 'Zurich', 'Financial Services', 'ane', array['ana'], 7891250.27, 5742914.06, 4472914.06, 0.00, 1270000.00, array['ZURICH']),
  ('portfolio-crt4', 'Crt4', 'Crt4', 'Financial Services', 'ane', array['ana'], 0.00, 3767502.13, 451184.93, 0.00, 3316317.20, array['CRT4']),
  ('portfolio-picpay', 'Picpay', 'Picpay', 'Financial Services', 'ane', array['ana'], 0.00, 2884854.31, 1225489.29, 0.00, 1859365.03, array['PICPAY']),
  ('portfolio-csf', 'Csf', 'Csf', 'Financial Services', 'ane', array['ana'], 444625.44, 2598797.77, 1091068.90, 0.00, 2347633.95, array['CSF']),
  ('portfolio-associacao-open-finance', 'Associação Open Finance', 'Associação Open Finance', 'Financial Services', 'ane', array['ana'], 1141541.45, 1980193.81, 1051917.96, 0.00, 928275.84, array['ASSOCIAÇÃO OPEN FINANCE']),
  ('portfolio-opea', 'Opea', 'Opea', 'Financial Services', 'ane', array['ana'], 0.00, 1833333.33, 0.00, 0.00, 1833333.33, array['OPEA']),
  ('portfolio-professional-services', 'Professional Services', 'Professional Services', 'Financial Services', 'ane', array['ana'], 0.00, 1750000.00, 0.00, 0.00, 3500000.00, array['PROFESSIONAL SERVICES']),
  ('portfolio-livelo-s-a', 'Livelo S.A.', 'Livelo S.A.', 'Financial Services', 'ane', array['ana'], 1989509.21, 1646702.12, 1646702.12, 0.00, 0.00, array['LIVELO S.A.']),
  ('portfolio-travelex', 'Travelex', 'Travelex', 'Financial Services', 'ane', array['ana'], 1322813.75, 1378530.22, 1378530.22, 0.00, 0.00, array['TRAVELEX']),
  ('portfolio-bradesco', 'Bradesco', 'Bradesco', 'Financial Services', 'ane', array['ana'], 0.00, 1000000.00, 0.00, 0.00, 2000000.00, array['BRADESCO']),
  ('portfolio-banco-abc', 'Banco Abc', 'Banco Abc', 'Financial Services', 'ane', array['ana'], 880035.78, 935000.00, 935000.00, 0.00, 0.00, array['BANCO ABC']),
  ('portfolio-banco-bocom', 'Banco Bocom', 'Banco Bocom', 'Financial Services', 'ane', array['ana'], 977785.79, 878571.05, 878571.05, 0.00, 0.00, array['BANCO BOCOM']),
  ('portfolio-pismo', 'Pismo', 'Pismo', 'Financial Services', 'ane', array['ana'], 0.00, 600000.00, 0.00, 0.00, 1200000.00, array['PISMO']),
  ('portfolio-sicredi', 'Sicredi', 'Sicredi', 'Financial Services', 'ane', array['ana'], 0.00, 600000.00, 0.00, 0.00, 1200000.00, array['SICREDI']),
  ('portfolio-edenred', 'Edenred', 'Edenred', 'Financial Services', 'ane', array['ana'], 0.00, 425000.00, 0.00, 0.00, 425000.00, array['EDENRED']),
  ('portfolio-bbts', 'Bbts', 'Bbts', 'Financial Services', 'ane', array['ana'], 0.00, 400000.00, 0.00, 0.00, 800000.00, array['BBTS']),
  ('portfolio-csu', 'Csu', 'Csu', 'Financial Services', 'ane', array['ana'], 0.00, 400000.00, 0.00, 0.00, 800000.00, array['CSU']),
  ('portfolio-fis', 'Fis', 'Fis', 'Financial Services', 'ane', array['ana'], 0.00, 400000.00, 0.00, 0.00, 800000.00, array['FIS']),
  ('portfolio-bullla', 'Bullla', 'Bullla', 'Financial Services', 'ane', array['ana'], 0.00, 360000.00, 0.00, 0.00, 360000.00, array['BULLLA']),
  ('portfolio-xp', 'XP', 'XP', 'Financial Services', 'ane', array['ana'], 801913.46, 348590.60, 348590.60, 0.00, 0.00, array['XP INVESTIMENTOS']),
  ('portfolio-quod', 'Quod', 'Quod', 'Financial Services', 'ane', array['ana'], 0.00, 300000.00, 0.00, 0.00, 600000.00, array['QUOD']),
  ('portfolio-sicoob', 'Sicoob', 'Sicoob', 'Financial Services', 'ane', array['ana'], 0.00, 300000.00, 0.00, 0.00, 600000.00, array['SICOOB']),
  ('portfolio-banco-bs2', 'Banco Bs2', 'Banco Bs2', 'Financial Services', 'ane', array['ana'], 0.00, 270000.00, 0.00, 0.00, 270000.00, array['BANCO BS2']),
  ('portfolio-new-logo', 'New Logo', 'New Logo', 'Financial Services', 'ane', array['ana'], 0.00, 250000.00, 0.00, 0.00, 250000.00, array['NEW LOGO']),
  ('portfolio-asa-investments', 'Asa Investments', 'Asa Investments', 'Financial Services', 'ane', array['ana'], 0.00, 200000.00, 200000.00, 0.00, 200000.00, array['ASA INVESTMENTS']),
  ('portfolio-banco-rci', 'Banco Rci', 'Banco Rci', 'Financial Services', 'ane', array['ana'], 0.00, 150000.00, 0.00, 0.00, 150000.00, array['BANCO RCI']),
  ('portfolio-agibank', 'Agibank', 'Agibank', 'Financial Services', 'ane', array['ana'], 0.00, 100000.00, 0.00, 0.00, 200000.00, array['AGIBANK']),
  ('portfolio-intel', 'Intel', 'Intel', 'Financial Services', 'ane', array['ana'], 0.00, 50000.00, 0.00, 0.00, 100000.00, array['INTEL'])
on conflict (id) do update set
  customer_name = excluded.customer_name,
  customer_cluster = excluded.customer_cluster,
  industry = excluded.industry,
  director_id = excluded.director_id,
  manager_ids = excluded.manager_ids,
  revenue_current = excluded.revenue_current,
  revenue_target = excluded.revenue_target,
  renewal_revenue = excluded.renewal_revenue,
  expansion_revenue = excluded.expansion_revenue,
  new_business_revenue = excluded.new_business_revenue,
  source_customer_names = excluded.source_customer_names,
  updated_at = now();

update public.customers set revenue = 195695559.03 where id = 'client-itau';
update public.customers set revenue = 14511096.32 where id = 'client-alelo';
update public.customers set revenue = 12435626.88 where id = 'client-nuclea';
update public.customers set revenue = 96001544.74 where id = 'client-santander';
update public.customers set revenue = 16200000.49 where id = 'client-b3';
update public.customers set revenue = 0.00 where id = 'client-safra';
update public.customers set revenue = 29925499.89 where id = 'client-btg';
update public.customers set revenue = 27906267.39 where id = 'client-bv';
update public.customers set revenue = 801913.46 where id = 'client-xp';
update public.customers set revenue = 0.00 where id = 'client-inter';
update public.customers set revenue = 0.00 where id = 'client-porto';

do $$
declare
  table_name text;
begin
  foreach table_name in array array['portfolio_directors', 'portfolio_delivery_managers', 'revenue_plans']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.portfolio_directors enable row level security;
alter table public.portfolio_delivery_managers enable row level security;
alter table public.revenue_plans enable row level security;

drop policy if exists "Active BRQ users read portfolio directors" on public.portfolio_directors;
drop policy if exists "Editors manage portfolio directors" on public.portfolio_directors;
drop policy if exists "Active BRQ users read portfolio managers" on public.portfolio_delivery_managers;
drop policy if exists "Editors manage portfolio managers" on public.portfolio_delivery_managers;
drop policy if exists "Active BRQ users read revenue plans" on public.revenue_plans;
drop policy if exists "Editors manage revenue plans" on public.revenue_plans;

revoke all on public.portfolio_directors, public.portfolio_delivery_managers, public.revenue_plans from anon;
grant select on public.portfolio_directors, public.portfolio_delivery_managers, public.revenue_plans to authenticated;
grant insert, update, delete on public.portfolio_directors, public.portfolio_delivery_managers, public.revenue_plans to authenticated;

create policy "Active BRQ users read portfolio directors" on public.portfolio_directors for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage portfolio directors" on public.portfolio_directors for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Active BRQ users read portfolio managers" on public.portfolio_delivery_managers for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage portfolio managers" on public.portfolio_delivery_managers for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Active BRQ users read revenue plans" on public.revenue_plans for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage revenue plans" on public.revenue_plans for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
