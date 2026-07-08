-- Allow more than one Hunter/Hunter + Farmer to be associated with the same
-- customer. The current source of truth for Hunter value distribution is the
-- yearly allocation grain in revenue_target_allocations and, for Studio Hunter,
-- studio_target_allocations.hunter_person_id.

drop trigger if exists person_customer_assignments_single_hunter on public.person_customer_assignments;
drop trigger if exists person_customer_assignments_unique_hunter on public.person_customer_assignments;
drop trigger if exists people_hunter_assignment_consistency on public.people;

drop function if exists public.ensure_single_hunter_assignment();
drop function if exists public.ensure_person_hunter_assignment_consistency();
drop function if exists public.assert_unique_hunter_customer_assignment();

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname in (
      'person_customer_assignments_single_hunter',
      'person_customer_assignments_unique_hunter',
      'people_hunter_assignment_consistency'
    )
    and not tgisinternal
  ) then
    raise exception 'Legacy Hunter exclusivity trigger still exists.';
  end if;
end $$;
