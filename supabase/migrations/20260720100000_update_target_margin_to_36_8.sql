-- Update the informational customer target margin to 36.8%.
--
-- Margin remains an informational customer attribute in this release. This
-- migration aligns existing records and provider defaults with the new target.

update public.customers
set margin = 36.80
where margin is distinct from 36.80;

alter table public.customers
  alter column margin set default 36.80;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'financial_source_customers'
  ) then
    alter table public.financial_source_customers
      alter column margin set default 36.80;

    update public.financial_source_customers
    set margin = 36.80
    where margin is distinct from 36.80;
  end if;
end $$;

select
  count(*) as customer_count,
  round(avg(margin), 2) as average_margin,
  round(min(margin), 2) as minimum_margin,
  round(max(margin), 2) as maximum_margin
from public.customers;
