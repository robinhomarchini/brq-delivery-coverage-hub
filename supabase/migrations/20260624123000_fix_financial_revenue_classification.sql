alter table public.revenue_plans add column if not exists hunter_revenue numeric(14,2) not null default 0;

alter table public.revenue_plans add column if not exists delivery_farmer_revenue numeric(14,2) not null default 0;

insert into public.revenue_plans (id, customer_name, customer_cluster, industry, director_id, manager_ids, revenue_current, revenue_target, hunter_revenue, delivery_farmer_revenue, source_customer_names) values
  ('portfolio-itau', 'Itaú', 'Itaú', 'Financial Services', 'ca', array['bruno','orion','fernanda','bonfim'], 195695559.03, 236805232.37, 44089655.33, 192715577.04, array['BANCO ITAÚ S.A.','FUNDAÇÃO ITAÚ']),
  ('portfolio-santander', 'Santander', 'Santander', 'Financial Services', 'ane', array['ana'], 96001544.74, 114020844.67, 14955000.00, 99065844.67, array['SANTANDER']),
  ('portfolio-b3', 'B3', 'B3', 'Financial Services', 'ane', array['ana'], 16200000.49, 36918589.33, 7875497.66, 29043091.67, array['B3','B3 IP','BANCO B3']),
  ('portfolio-btg', 'BTG', 'BTG', 'Financial Services', 'ane', array['ana'], 0.00, 29925499.89, 1974000.00, 27951499.89, array['BANCO PACTUAL']),
  ('portfolio-redecard', 'Redecard', 'Redecard', 'Financial Services', 'ane', array['ana'], 25043493.22, 25640540.40, 2847489.24, 22793051.16, array['REDECARD']),
  ('portfolio-bv', 'BV', 'BV', 'Financial Services', 'ane', array['ana'], 27906267.39, 15491912.31, 800000.00, 14691912.31, array['VOTORANTIM']),
  ('portfolio-alelo', 'Alelo', 'Alelo', 'Financial Services', 'ca', array['ana'], 0.00, 14211096.32, 11033497.05, 3177599.27, array['ALELO']),
  ('portfolio-nuclea', 'Núclea', 'Núclea', 'Financial Services', 'ca', array['ana'], 10733605.63, 12435626.88, 5668109.65, 6767517.22, array['CIP']),
  ('portfolio-credit-suisse', 'Credit Suisse', 'Credit Suisse', 'Financial Services', 'ane', array['ana'], 10405485.59, 12025205.71, 0.00, 12025205.71, array['CREDIT SUISSE']),
  ('portfolio-visa', 'Visa', 'Visa', 'Financial Services', 'ane', array['ana'], 0.00, 9244752.82, 5868165.97, 3376586.86, array['VISA']),
  ('portfolio-zurich', 'Zurich', 'Zurich', 'Financial Services', 'ane', array['ana'], 7891250.27, 5742914.06, 850000.00, 4892914.06, array['ZURICH']),
  ('portfolio-crt4', 'Crt4', 'Crt4', 'Financial Services', 'ane', array['ana'], 0.00, 3767502.13, 490066.67, 3277435.46, array['CRT4']),
  ('portfolio-picpay', 'Picpay', 'Picpay', 'Financial Services', 'ane', array['ana'], 0.00, 2884854.31, 1659365.03, 1225489.29, array['PICPAY']),
  ('portfolio-csf', 'Csf', 'Csf', 'Financial Services', 'ane', array['ana'], 444625.44, 2598797.77, 2347633.95, 251163.82, array['CSF']),
  ('portfolio-associacao-open-finance', 'Associação Open Finance', 'Associação Open Finance', 'Financial Services', 'ane', array['ana'], 1141541.45, 1980193.81, 928275.84, 1051917.96, array['ASSOCIAÇÃO OPEN FINANCE']),
  ('portfolio-opea', 'Opea', 'Opea', 'Financial Services', 'ane', array['ana'], 0.00, 1833333.33, 1833333.33, 0.00, array['OPEA']),
  ('portfolio-professional-services', 'Professional Services', 'Professional Services', 'Financial Services', 'ane', array['ana'], 0.00, 1750000.00, 1750000.00, 0.00, array['PROFESSIONAL SERVICES']),
  ('portfolio-livelo-s-a', 'Livelo S.A.', 'Livelo S.A.', 'Financial Services', 'ane', array['ana'], 1989509.21, 1646702.12, 0.00, 1646702.12, array['LIVELO S.A.']),
  ('portfolio-travelex', 'Travelex', 'Travelex', 'Financial Services', 'ane', array['ana'], 1322813.75, 1378530.22, 0.00, 1378530.22, array['TRAVELEX']),
  ('portfolio-bradesco', 'Bradesco', 'Bradesco', 'Financial Services', 'ane', array['ana'], 0.00, 1000000.00, 1000000.00, 0.00, array['BRADESCO']),
  ('portfolio-banco-abc', 'Banco Abc', 'Banco Abc', 'Financial Services', 'ane', array['ana'], 880035.78, 935000.00, 0.00, 935000.00, array['BANCO ABC']),
  ('portfolio-banco-bocom', 'Banco Bocom', 'Banco Bocom', 'Financial Services', 'ane', array['ana'], 977785.79, 878571.05, 0.00, 878571.05, array['BANCO BOCOM']),
  ('portfolio-pismo', 'Pismo', 'Pismo', 'Financial Services', 'ane', array['ana'], 0.00, 600000.00, 600000.00, 0.00, array['PISMO']),
  ('portfolio-sicredi', 'Sicredi', 'Sicredi', 'Financial Services', 'ane', array['ana'], 0.00, 600000.00, 600000.00, 0.00, array['SICREDI']),
  ('portfolio-edenred', 'Edenred', 'Edenred', 'Financial Services', 'ane', array['ana'], 0.00, 425000.00, 425000.00, 0.00, array['EDENRED']),
  ('portfolio-bbts', 'Bbts', 'Bbts', 'Financial Services', 'ane', array['ana'], 0.00, 400000.00, 400000.00, 0.00, array['BBTS']),
  ('portfolio-csu', 'Csu', 'Csu', 'Financial Services', 'ane', array['ana'], 0.00, 400000.00, 400000.00, 0.00, array['CSU']),
  ('portfolio-fis', 'Fis', 'Fis', 'Financial Services', 'ane', array['ana'], 0.00, 400000.00, 400000.00, 0.00, array['FIS']),
  ('portfolio-bullla', 'Bullla', 'Bullla', 'Financial Services', 'ane', array['ana'], 0.00, 360000.00, 360000.00, 0.00, array['BULLLA']),
  ('portfolio-xp', 'XP', 'XP', 'Financial Services', 'ane', array['ana'], 801913.46, 348590.60, 0.00, 348590.60, array['XP INVESTIMENTOS']),
  ('portfolio-quod', 'Quod', 'Quod', 'Financial Services', 'ane', array['ana'], 0.00, 300000.00, 300000.00, 0.00, array['QUOD']),
  ('portfolio-sicoob', 'Sicoob', 'Sicoob', 'Financial Services', 'ane', array['ana'], 0.00, 300000.00, 300000.00, 0.00, array['SICOOB']),
  ('portfolio-banco-bs2', 'Banco Bs2', 'Banco Bs2', 'Financial Services', 'ane', array['ana'], 0.00, 270000.00, 270000.00, 0.00, array['BANCO BS2']),
  ('portfolio-new-logo', 'New Logo', 'New Logo', 'Financial Services', 'ane', array['ana'], 0.00, 250000.00, 0.00, 250000.00, array['NEW LOGO']),
  ('portfolio-asa-investments', 'Asa Investments', 'Asa Investments', 'Financial Services', 'ane', array['ana'], 0.00, 200000.00, 200000.00, 0.00, array['ASA INVESTMENTS']),
  ('portfolio-banco-rci', 'Banco Rci', 'Banco Rci', 'Financial Services', 'ane', array['ana'], 0.00, 150000.00, 150000.00, 0.00, array['BANCO RCI']),
  ('portfolio-agibank', 'Agibank', 'Agibank', 'Financial Services', 'ane', array['ana'], 0.00, 100000.00, 100000.00, 0.00, array['AGIBANK']),
  ('portfolio-intel', 'Intel', 'Intel', 'Financial Services', 'ane', array['ana'], 0.00, 50000.00, 50000.00, 0.00, array['INTEL'])
on conflict (id) do update set
  customer_name = excluded.customer_name,
  customer_cluster = excluded.customer_cluster,
  industry = excluded.industry,
  director_id = excluded.director_id,
  manager_ids = excluded.manager_ids,
  revenue_current = excluded.revenue_current,
  revenue_target = excluded.revenue_target,
  hunter_revenue = excluded.hunter_revenue,
  delivery_farmer_revenue = excluded.delivery_farmer_revenue,
  source_customer_names = excluded.source_customer_names,
  updated_at = now();

update public.revenue_plans set new_business_revenue = hunter_revenue, renewal_revenue = delivery_farmer_revenue, expansion_revenue = 0 where true;

update public.customers set revenue = 236805232.37 where id = 'client-itau';

update public.customers set revenue = 14211096.32 where id = 'client-alelo';

update public.customers set revenue = 12435626.88 where id = 'client-nuclea';

update public.customers set revenue = 114020844.67 where id = 'client-santander';

update public.customers set revenue = 36918589.33 where id = 'client-b3';

update public.customers set revenue = 0.00 where id = 'client-safra';

update public.customers set revenue = 29925499.89 where id = 'client-btg';

update public.customers set revenue = 15491912.31 where id = 'client-bv';

update public.customers set revenue = 348590.60 where id = 'client-xp';

update public.customers set revenue = 0.00 where id = 'client-inter';

update public.customers set revenue = 0.00 where id = 'client-porto';