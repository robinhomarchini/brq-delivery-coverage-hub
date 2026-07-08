-- Preserve people history by modeling lifecycle instead of deleting records.

alter table public.people
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists closed_at date,
  add column if not exists closed_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'people_lifecycle_status_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people add constraint people_lifecycle_status_check
      check (lifecycle_status in ('active', 'inactive', 'closed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'people_closed_requires_date_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people add constraint people_closed_requires_date_check
      check (lifecycle_status <> 'closed' or closed_at is not null);
  end if;
end $$;

update public.people
set lifecycle_status = case when active then 'active' else 'inactive' end
where lifecycle_status is null
   or lifecycle_status not in ('active', 'inactive', 'closed');

create index if not exists people_lifecycle_status_idx
  on public.people(lifecycle_status);

notify pgrst, 'reload schema';
