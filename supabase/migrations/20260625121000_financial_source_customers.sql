-- Add all Financial BU source customers from the spreadsheet "Cliente" column.
--
-- public.customers stores operational source customers.
-- public.revenue_plans stores imported analytical clusters.

create temporary table tmp_financial_source_customers (
  id text primary key,
  name text not null,
  director_id text not null,
  manager_ids text[] not null,
  margin numeric(5,2) not null default 22.50
) on commit drop;

insert into tmp_financial_source_customers (id, name, director_id, manager_ids) values
  ('client-agibank', 'AGIBANK', 'ane', array['ana']::text[]),
  ('client-alelo', 'ALELO', 'ca', array['ana']::text[]),
  ('client-asa-investments', 'ASA INVESTMENTS', 'ane', array['ana']::text[]),
  ('client-associacao-open-finance', 'ASSOCIAÇÃO OPEN FINANCE', 'ane', array['ana']::text[]),
  ('client-b3', 'B3', 'ane', array['ana']::text[]),
  ('client-b3-ip', 'B3 IP', 'ane', array['ana']::text[]),
  ('client-banco-abc', 'BANCO ABC', 'ane', array['ana']::text[]),
  ('client-banco-b3', 'BANCO B3', 'ane', array['ana']::text[]),
  ('client-banco-bocom', 'BANCO BOCOM', 'ane', array['ana']::text[]),
  ('client-banco-bs2', 'BANCO BS2', 'ane', array['ana']::text[]),
  ('client-banco-itau-s-a', 'BANCO ITAÚ S.A.', 'ca', array['bruno','orion','fernanda','bonfim']::text[]),
  ('client-banco-pactual', 'BANCO PACTUAL', 'ane', array['ana']::text[]),
  ('client-banco-rci', 'BANCO RCI', 'ane', array['ana']::text[]),
  ('client-bbts', 'BBTS', 'ane', array['ana']::text[]),
  ('client-bradesco', 'BRADESCO', 'ane', array['ana']::text[]),
  ('client-bullla', 'BULLLA', 'ane', array['ana']::text[]),
  ('client-cip', 'CIP', 'ca', array['ana']::text[]),
  ('client-credit-suisse', 'CREDIT SUISSE', 'ane', array['ana']::text[]),
  ('client-crt4', 'CRT4', 'ane', array['ana']::text[]),
  ('client-csf', 'CSF', 'ane', array['ana']::text[]),
  ('client-csu', 'CSU', 'ane', array['ana']::text[]),
  ('client-edenred', 'EDENRED', 'ane', array['ana']::text[]),
  ('client-fis', 'FIS', 'ane', array['ana']::text[]),
  ('client-fundacao-itau', 'FUNDAÇÃO ITAÚ', 'ca', array['bruno','orion','fernanda','bonfim']::text[]),
  ('client-intel', 'INTEL', 'ane', array['ana']::text[]),
  ('client-livelo-s-a', 'LIVELO S.A.', 'ane', array['ana']::text[]),
  ('client-new-logo', 'NEW LOGO', 'ane', array['ana']::text[]),
  ('client-opea', 'OPEA', 'ane', array['ana']::text[]),
  ('client-picpay', 'PICPAY', 'ane', array['ana']::text[]),
  ('client-pismo', 'PISMO', 'ane', array['ana']::text[]),
  ('client-professional-services', 'PROFESSIONAL SERVICES', 'ane', array['ana']::text[]),
  ('client-quod', 'QUOD', 'ane', array['ana']::text[]),
  ('client-redecard', 'REDECARD', 'ane', array['ana']::text[]),
  ('client-santander', 'SANTANDER', 'ane', array['ana']::text[]),
  ('client-sicoob', 'SICOOB', 'ane', array['ana']::text[]),
  ('client-sicredi', 'SICREDI', 'ane', array['ana']::text[]),
  ('client-travelex', 'TRAVELEX', 'ane', array['ana']::text[]),
  ('client-visa', 'VISA', 'ane', array['ana']::text[]),
  ('client-votorantim', 'VOTORANTIM', 'ane', array['ana']::text[]),
  ('client-xp-investimentos', 'XP INVESTIMENTOS', 'ane', array['ana']::text[]),
  ('client-zurich', 'ZURICH', 'ane', array['ana']::text[])
on conflict (id) do update set
  name = excluded.name,
  director_id = excluded.director_id,
  manager_ids = excluded.manager_ids,
  margin = excluded.margin;

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
)
select
  source.id,
  source.name,
  'Financial Services',
  source.director_id,
  source.manager_ids[1],
  source.manager_ids,
  null,
  coalesce(round(plan.revenue_target / greatest(array_length(plan.source_customer_names, 1), 1), 2), 0),
  source.margin,
  true
from tmp_financial_source_customers source
left join public.revenue_plans plan
  on source.name = any(plan.source_customer_names)
on conflict (id) do update set
  name = excluded.name,
  industry = excluded.industry,
  director_responsible_id = excluded.director_responsible_id,
  manager_responsible_id = excluded.manager_responsible_id,
  manager_responsible_ids = excluded.manager_responsible_ids,
  revenue = excluded.revenue,
  margin = excluded.margin,
  strategic_account = excluded.strategic_account;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'person_customer_assignments'
  ) then
    insert into public.person_customer_assignments(person_id, customer_id, source)
    select manager_id, source.id, 'financial_source_customer_seed'
    from tmp_financial_source_customers source
    cross join lateral unnest(source.manager_ids) as manager_id
    where exists (select 1 from public.people p where p.id = manager_id)
    on conflict (person_id, customer_id) do nothing;
  end if;
end $$;

insert into public.revenue_target_allocations (
  id,
  customer_id,
  person_id,
  target_type,
  target_year,
  amount,
  notes
)
select
  format('target-%s-%s-farmer-renewal-2026', source.id, manager_id),
  source.id,
  manager_id,
  'farmer_renewal',
  2026,
  round(
    coalesce(plan.delivery_farmer_revenue, plan.renewal_revenue + plan.expansion_revenue, 0)
    / greatest(array_length(plan.source_customer_names, 1), 1)
    / greatest(array_length(source.manager_ids, 1), 1),
    2
  ),
  'Carga inicial importada da planilha Financial BU.'
from tmp_financial_source_customers source
join public.revenue_plans plan
  on source.name = any(plan.source_customer_names)
cross join lateral unnest(source.manager_ids) as manager_id
where exists (select 1 from public.people p where p.id = manager_id)
on conflict (id) do nothing;

insert into public.revenue_target_allocations (
  id,
  customer_id,
  person_id,
  target_type,
  target_year,
  amount,
  notes
)
select
  format('target-%s-renan-hunter-2026', source.id),
  source.id,
  'renan',
  'hunter',
  2026,
  round(coalesce(plan.hunter_revenue, plan.new_business_revenue, 0) / greatest(array_length(plan.source_customer_names, 1), 1), 2),
  'Atribuição Hunter provisória para reporting; não altera ownership de Delivery.'
from tmp_financial_source_customers source
join public.revenue_plans plan
  on source.name = any(plan.source_customer_names)
where coalesce(plan.hunter_revenue, plan.new_business_revenue, 0) > 0
  and exists (select 1 from public.people p where p.id = 'renan')
on conflict (id) do nothing;

do $$
declare
  missing_count integer;
begin
  select count(*)
  into missing_count
  from tmp_financial_source_customers source
  where not exists (
    select 1
    from public.customers customer
    where customer.id = source.id
  );

  if missing_count <> 0 then
    raise exception 'Financial source customer seed failed: % customers are missing', missing_count;
  end if;
end $$;
