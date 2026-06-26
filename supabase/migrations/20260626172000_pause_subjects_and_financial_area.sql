-- Pause subject-oriented UX and standardize Ane/CA direct reports as Financial Services.
-- Subject data is intentionally preserved; this migration only aligns persisted people area.

update public.people
set area_id = 'area-financial',
    updated_at = now()
where active = true
  and coalesce(role_type, '') <> 'Director'
  and (
    director_id in ('ane', 'ca')
    or manager_id in ('ane', 'ca')
  );

select
  area_id,
  count(*) as people_count
from public.people
where active = true
  and coalesce(role_type, '') <> 'Director'
  and (
    director_id in ('ane', 'ca')
    or manager_id in ('ane', 'ca')
  )
group by area_id
order by area_id;
