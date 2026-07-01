-- Standardize the current informational target margin.
--
-- Margin is still informational in this release; future versions may evolve it
-- into an actual-vs-target financial fact with period and source attribution.

update public.customers
set margin = 35.80
where margin is distinct from 35.80;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'financial_source_customers'
  ) then
    alter table public.financial_source_customers
      alter column margin set default 35.80;

    update public.financial_source_customers
    set margin = 35.80
    where margin is distinct from 35.80;
  end if;
end $$;

select
  count(*) as customer_count,
  round(avg(margin), 2) as average_margin,
  round(min(margin), 2) as minimum_margin,
  round(max(margin), 2) as maximum_margin
from public.customers;
