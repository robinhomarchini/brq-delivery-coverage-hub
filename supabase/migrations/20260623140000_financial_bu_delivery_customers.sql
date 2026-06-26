alter table public.customers
  add column if not exists manager_responsible_ids text[] not null default '{}';

alter table public.customers
  alter column territory_id drop not null;

update public.customers
set manager_responsible_ids = array[manager_responsible_id]
where manager_responsible_ids = '{}';

create index if not exists customers_manager_responsible_ids_idx
  on public.customers using gin (manager_responsible_ids);

update public.people
set name = 'Ricardo Bonfim'
where id = 'bonfim';

delete from public.subjects
where customer_id in (
  'client-stone',
  'client-tokio',
  'client-renner',
  'client-natura',
  'client-embraer',
  'client-mercadolivre',
  'client-vivo',
  'client-globo',
  'client-localiza',
  'client-fleury',
  'client-raizen',
  'client-suzano',
  'client-randon',
  'client-hapvida',
  'client-serpro',
  'client-nubank',
  'client-contaazul'
);

delete from public.customers
where id in (
  'client-stone',
  'client-tokio',
  'client-renner',
  'client-natura',
  'client-embraer',
  'client-mercadolivre',
  'client-vivo',
  'client-globo',
  'client-localiza',
  'client-fleury',
  'client-raizen',
  'client-suzano',
  'client-randon',
  'client-hapvida',
  'client-serpro',
  'client-nubank',
  'client-contaazul'
);

insert into public.customers (
  id,
  name,
  industry,
  director_responsible_id,
  manager_responsible_id,
  manager_responsible_ids,
  territory_id,
  revenue,
  margin,
  strategic_account
) values
  ('client-itau', 'Itaú', 'Financial Services', 'ca', 'bruno', array['bruno', 'orion', 'fernanda', 'bonfim'], null, 12800000, 24.6, true),
  ('client-alelo', 'Alelo', 'Financial Services', 'ca', 'ana', array['ana'], null, 6900000, 21.2, true),
  ('client-nuclea', 'Núclea', 'Financial Services', 'ca', 'ana', array['ana'], null, 5400000, 19.8, true),
  ('client-santander', 'Santander', 'Financial Services', 'ane', 'ana', array['ana'], null, 9800000, 25.3, true),
  ('client-b3', 'B3', 'Financial Services', 'ane', 'ana', array['ana'], null, 6100000, 22.5, true),
  ('client-safra', 'Safra', 'Financial Services', 'ane', 'ana', array['ana'], null, 4600000, 23.2, true),
  ('client-btg', 'BTG', 'Financial Services', 'ane', 'ana', array['ana'], null, 5200000, 27.4, true),
  ('client-bv', 'BV', 'Financial Services', 'ane', 'ana', array['ana'], null, 3800000, 20.7, true),
  ('client-xp', 'XP', 'Financial Services', 'ane', 'ana', array['ana'], null, 4200000, 17.9, true),
  ('client-inter', 'Inter', 'Financial Services', 'ane', 'ana', array['ana'], null, 3400000, 21.8, true),
  ('client-porto', 'Porto', 'Financial Services', 'ane', 'ana', array['ana'], null, 5700000, 22.9, true)
on conflict (id) do update set
  name = excluded.name,
  industry = excluded.industry,
  director_responsible_id = excluded.director_responsible_id,
  manager_responsible_id = excluded.manager_responsible_id,
  manager_responsible_ids = excluded.manager_responsible_ids,
  revenue = excluded.revenue,
  margin = excluded.margin,
  strategic_account = excluded.strategic_account;

insert into public.subjects (id, customer_id, name, description, owner_person_id, status, strategic) values
  ('subject-itau-data', 'client-itau', 'Dados', 'Frente de atuação de Dados no cliente.', 'bruno', 'Ativo', true),
  ('subject-itau-checking', 'client-itau', 'Conta Corrente', 'Frente de atuação de Conta Corrente no cliente.', 'orion', 'Ativo', true),
  ('subject-itau-investments', 'client-itau', 'Investimentos', 'Frente de atuação de Investimentos no cliente.', 'fernanda', 'Em evolução', true),
  ('subject-itau-cards', 'client-itau', 'Cartões', 'Frente de atuação de Cartões no cliente.', 'bonfim', 'Ativo', false),
  ('subject-alelo-benefits', 'client-alelo', 'Benefícios', 'Frente de atuação de Benefícios no cliente.', 'ana', 'Ativo', true),
  ('subject-alelo-data', 'client-alelo', 'Dados', 'Frente de atuação de Dados no cliente.', 'ana', 'Em evolução', false),
  ('subject-nuclea-payments', 'client-nuclea', 'Pagamentos', 'Frente de atuação de Pagamentos no cliente.', 'ana', 'Ativo', true),
  ('subject-nuclea-data', 'client-nuclea', 'Dados', 'Frente de atuação de Dados no cliente.', 'ana', 'Ativo', false),
  ('subject-santander-checking', 'client-santander', 'Conta Corrente', 'Frente de atuação de Conta Corrente no cliente.', 'ana', 'Ativo', true),
  ('subject-santander-investments', 'client-santander', 'Investimentos', 'Frente de atuação de Investimentos no cliente.', 'ana', 'Ativo', true),
  ('subject-b3-capital-markets', 'client-b3', 'Mercado de Capitais', 'Frente de atuação de Mercado de Capitais no cliente.', 'ana', 'Ativo', true),
  ('subject-safra-credit', 'client-safra', 'Crédito', 'Frente de atuação de Crédito no cliente.', 'ana', 'Ativo', true),
  ('subject-btg-investments', 'client-btg', 'Investimentos', 'Frente de atuação de Investimentos no cliente.', 'ana', 'Ativo', true),
  ('subject-bv-auto', 'client-bv', 'Financiamento', 'Frente de atuação de Financiamento no cliente.', 'ana', 'Ativo', false),
  ('subject-xp-investments', 'client-xp', 'Investimentos', 'Frente de atuação de Investimentos no cliente.', 'ana', 'Em evolução', true),
  ('subject-inter-digital', 'client-inter', 'Banco Digital', 'Frente de atuação de Banco Digital no cliente.', 'ana', 'Ativo', true),
  ('subject-porto-insurance', 'client-porto', 'Seguros', 'Frente de atuação de Seguros no cliente.', 'ana', 'Ativo', true)
on conflict (id) do update set
  customer_id = excluded.customer_id,
  name = excluded.name,
  description = excluded.description,
  owner_person_id = excluded.owner_person_id,
  status = excluded.status,
  strategic = excluded.strategic;
