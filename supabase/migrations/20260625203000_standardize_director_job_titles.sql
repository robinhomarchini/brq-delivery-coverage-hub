-- Standardize Delivery director job titles without gendered variants.
-- This migration is idempotent and only updates the exact legacy label.

update public.people
set job_title = 'Diretor de Delivery',
    updated_at = now()
where job_title = 'Diretora de Delivery';

update public.portfolio_directors
set job_title = 'Diretor de Delivery',
    updated_at = now()
where job_title = 'Diretora de Delivery';

-- Smoke check: no persisted director title should keep the gendered variant.
select
  'people' as source,
  count(*) filter (where job_title = 'Diretora de Delivery') as legacy_titles,
  count(*) filter (where job_title = 'Diretor de Delivery') as neutral_titles
from public.people
where job_title in ('Diretora de Delivery', 'Diretor de Delivery')
union all
select
  'portfolio_directors' as source,
  count(*) filter (where job_title = 'Diretora de Delivery') as legacy_titles,
  count(*) filter (where job_title = 'Diretor de Delivery') as neutral_titles
from public.portfolio_directors
where job_title in ('Diretora de Delivery', 'Diretor de Delivery');
