-- Add narrow indexes for the query shapes used by the repository, reports and
-- target reconciliation screens. These indexes are non-destructive and preserve
-- the existing RLS/RBAC model.

create index if not exists revenue_target_allocations_customer_year_idx
  on public.revenue_target_allocations(customer_id, target_year);

create index if not exists revenue_target_allocations_customer_person_type_year_idx
  on public.revenue_target_allocations(customer_id, person_id, target_type, target_year);

create index if not exists revenue_target_allocations_person_year_type_idx
  on public.revenue_target_allocations(person_id, target_year, target_type);

create index if not exists studio_target_allocations_customer_year_idx
  on public.studio_target_allocations(customer_id, target_year);

create index if not exists studio_target_allocations_customer_area_year_idx
  on public.studio_target_allocations(customer_id, area_id, target_year);

create index if not exists specialist_hunter_studio_assignments_person_year_idx
  on public.specialist_hunter_studio_assignments(person_id, target_year);

create index if not exists specialist_hunter_studio_assignments_studio_allocation_idx
  on public.specialist_hunter_studio_assignments(studio_target_allocation_id);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'revenue_target_allocations'
      and indexname = 'revenue_target_allocations_customer_person_type_year_idx'
  ) then
    raise exception 'Performance index missing: revenue_target_allocations_customer_person_type_year_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'studio_target_allocations'
      and indexname = 'studio_target_allocations_customer_area_year_idx'
  ) then
    raise exception 'Performance index missing: studio_target_allocations_customer_area_year_idx';
  end if;
end $$;
