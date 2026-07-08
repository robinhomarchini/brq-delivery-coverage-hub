-- Add commercial Hunter attribution to Studio target allocations.
--
-- New business grain for Studio Hunter allocations:
-- customer_id + area_id + hunter_person_id + target_year.
-- Legacy rows without a Hunter remain readable and editable as unassigned.

alter table public.studio_target_allocations
  add column if not exists hunter_person_id text null references public.people(id) on delete set null;

create index if not exists studio_target_allocations_hunter_year_idx
  on public.studio_target_allocations(hunter_person_id, target_year)
  where hunter_person_id is not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'studio_target_allocations_customer_id_area_id_target_year_key'
  ) then
    alter table public.studio_target_allocations
      drop constraint studio_target_allocations_customer_id_area_id_target_year_key;
  end if;
end $$;

create unique index if not exists studio_target_allocations_customer_area_hunter_year_uidx
  on public.studio_target_allocations(customer_id, area_id, hunter_person_id, target_year)
  where hunter_person_id is not null;

create unique index if not exists studio_target_allocations_customer_area_unassigned_year_uidx
  on public.studio_target_allocations(customer_id, area_id, target_year)
  where hunter_person_id is null;

select
  target_year,
  count(*) as allocation_rows,
  count(*) filter (where hunter_person_id is null) as unassigned_hunter_rows,
  count(*) filter (where hunter_person_id is not null) as assigned_hunter_rows
from public.studio_target_allocations
group by target_year
order by target_year desc;
