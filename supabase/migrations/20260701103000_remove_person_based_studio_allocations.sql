-- Áreas / Studios are organizational delivery units, not people.
--
-- Customer-level studio targets remain in customers/customer_target_years.
-- Person-level revenue_target_allocations must represent only allocations to
-- people: Hunter and Renovação + Ampliação.

delete from public.revenue_target_allocations
where target_type = 'studio';

alter table public.revenue_target_allocations
  drop constraint if exists revenue_target_allocations_target_type_check;

alter table public.revenue_target_allocations
  add constraint revenue_target_allocations_target_type_check
  check (target_type in ('hunter', 'farmer_renewal')) not valid;

alter table public.revenue_target_allocations
  validate constraint revenue_target_allocations_target_type_check;
