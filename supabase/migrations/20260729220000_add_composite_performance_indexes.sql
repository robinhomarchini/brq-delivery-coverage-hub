-- Performance: composite indexes for frequent filter/join patterns
--
-- These indexes support the most common WHERE/JOIN predicates identified in
-- dashboard, repository, and import paths. They are additive and do not
-- modify existing schema or data.

create index if not exists idx_studio_target_allocations_customer_hunter_year
  on public.studio_target_allocations (customer_id, hunter_person_id, target_year);

create index if not exists idx_studio_target_allocations_customer_maintenance_year
  on public.studio_target_allocations (customer_id, maintenance_person_id, target_year);

create index if not exists idx_people_director_id
  on public.people (director_id);

create index if not exists idx_people_manager_id
  on public.people (manager_id);

create index if not exists idx_people_role_type_is_manager
  on public.people (role_type, is_manager);

create index if not exists idx_people_area_id
  on public.people (area_id);

create index if not exists idx_customers_director_responsible_id
  on public.customers (director_responsible_id);

create index if not exists idx_customers_manager_responsible_id
  on public.customers (manager_responsible_id);
