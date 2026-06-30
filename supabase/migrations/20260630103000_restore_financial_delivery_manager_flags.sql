-- Restore Financial BU Delivery manager governance flags.
--
-- Some original Delivery managers were later classified only as "Farmer" in the
-- role taxonomy, which made them disappear from customer manager selectors
-- because the application intentionally reads managers from people.is_manager.
-- Keep Hunters out of Delivery ownership, but mark the operational Farmer +
-- Delivery managers as selectable managers again.

update public.people
set
  role_type = 'Farmer + Delivery',
  is_manager = true,
  manager_id = 'ane',
  area_id = 'area-financial',
  hierarchy_level = 3,
  updated_at = now()
where id in ('andreia', 'bresciani', 'cris', 'everton', 'gege', 'varella');

update public.people
set
  is_manager = true,
  manager_id = 'ane',
  area_id = 'area-financial',
  hierarchy_level = 3,
  updated_at = now()
where id in ('ana', 'giullia')
  and role_type in ('Delivery', 'Farmer + Delivery');

update public.people
set
  is_manager = true,
  manager_id = 'ca',
  area_id = 'area-financial',
  hierarchy_level = 3,
  updated_at = now()
where id in ('balista', 'bonfim', 'bruno', 'fernanda', 'orion')
  and role_type in ('Delivery', 'Farmer + Delivery');

update public.people
set
  manager_id = 'robinson',
  updated_at = now()
where id in ('ane', 'ca', 'renan');

select
  count(*) filter (where id in ('andreia', 'bresciani', 'cris', 'everton', 'gege', 'varella') and role_type = 'Farmer + Delivery' and is_manager) as restored_farmer_delivery_managers,
  count(*) filter (where id in ('ana', 'giullia', 'balista', 'bonfim', 'bruno', 'fernanda', 'orion') and is_manager) as confirmed_delivery_managers,
  count(*) filter (where role_type = 'Hunter' and is_manager) as hunter_managers
from public.people;
