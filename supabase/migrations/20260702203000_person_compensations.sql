-- Store sensitive compensation data separately from people.
--
-- Source of truth: one current annual compensation row per person. Access is
-- restricted to active BRQ admins whose own people record has a VP job title.

create table if not exists public.person_compensations (
  person_id text primary key references public.people(id) on delete cascade,
  annual_salary numeric(14,2) not null check (annual_salary >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  effective_from date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_compensations_effective_from_idx
  on public.person_compensations(effective_from);

drop trigger if exists person_compensations_updated_at on public.person_compensations;
create trigger person_compensations_updated_at
before update on public.person_compensations
for each row execute function public.set_updated_at();

create or replace function public.can_manage_person_compensation()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users access_user
    join public.people person
      on lower(person.email) = lower(access_user.email)
    where access_user.user_id = auth.uid()
      and access_user.role = 'admin'
      and access_user.active
      and public.is_brq_email(access_user.email)
      and person.active
      and (
        person.job_title ~* '(^|[^[:alnum:]])vp([^[:alnum:]]|$)'
        or person.job_title ~* 'vice[-[:space:]]?presidente'
        or person.job_title ~* 'vice[[:space:]]president'
      )
  );
$$;

alter table public.person_compensations enable row level security;

drop policy if exists "VP admins read person compensations" on public.person_compensations;
drop policy if exists "VP admins manage person compensations" on public.person_compensations;

revoke all on public.person_compensations from anon;
grant select, insert, update, delete on public.person_compensations to authenticated;
grant execute on function public.can_manage_person_compensation() to authenticated;

create policy "VP admins read person compensations"
on public.person_compensations
for select
to authenticated
using (public.can_manage_person_compensation());

create policy "VP admins manage person compensations"
on public.person_compensations
for all
to authenticated
using (public.can_manage_person_compensation())
with check (public.can_manage_person_compensation());

do $$
begin
  if to_regclass('public.person_compensations') is null then
    raise exception 'person_compensations table was not created';
  end if;
end $$;

notify pgrst, 'reload schema';
