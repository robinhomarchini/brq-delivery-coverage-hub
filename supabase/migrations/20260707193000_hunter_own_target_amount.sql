-- Keep Hunter total as a derived value:
-- amount = own_amount + Studio Hunter allocated to the same customer/person/year.

alter table public.revenue_target_allocations
  add column if not exists own_amount numeric(14,2);

update public.revenue_target_allocations target
set own_amount = greatest(
  coalesce(target.amount, 0) - coalesce(studio.total_studio_hunter, 0),
  0
)
from (
  select
    customer_id,
    hunter_person_id as person_id,
    target_year,
    sum(coalesce(hunter_amount, 0)) as total_studio_hunter
  from public.studio_target_allocations
  where hunter_person_id is not null
  group by customer_id, hunter_person_id, target_year
) studio
where target.target_type = 'hunter'
  and target.customer_id = studio.customer_id
  and target.person_id = studio.person_id
  and target.target_year = studio.target_year
  and target.own_amount is null;

update public.revenue_target_allocations
set own_amount = amount
where target_type = 'hunter'
  and own_amount is null;

update public.revenue_target_allocations
set own_amount = null
where target_type <> 'hunter'
  and own_amount is not null;

create or replace function public.get_studio_hunter_total_for_person(
  p_customer_id text,
  p_person_id text,
  p_target_year integer
)
returns numeric
language sql
stable
as $$
  select coalesce(sum(coalesce(hunter_amount, 0)), 0)
  from public.studio_target_allocations
  where customer_id = p_customer_id
    and hunter_person_id = p_person_id
    and target_year = p_target_year;
$$;

create or replace function public.apply_hunter_total_from_own_amount()
returns trigger
language plpgsql
as $$
declare
  studio_total numeric;
begin
  if new.target_type = 'hunter' then
    studio_total := public.get_studio_hunter_total_for_person(new.customer_id, new.person_id, new.target_year);
    new.own_amount := greatest(coalesce(new.own_amount, coalesce(new.amount, 0) - studio_total), 0);
    new.amount := greatest(new.own_amount, 0) + studio_total;
  else
    new.own_amount := null;
  end if;
  return new;
end;
$$;

drop trigger if exists revenue_target_allocations_hunter_total_from_own
  on public.revenue_target_allocations;

create trigger revenue_target_allocations_hunter_total_from_own
before insert or update of amount, own_amount, customer_id, person_id, target_type, target_year
on public.revenue_target_allocations
for each row
execute function public.apply_hunter_total_from_own_amount();

create or replace function public.refresh_hunter_total_from_studio()
returns trigger
language plpgsql
as $$
declare
  affected_customer_id text;
  affected_person_id text;
  affected_year integer;
begin
  affected_customer_id := coalesce(new.customer_id, old.customer_id);
  affected_person_id := coalesce(new.hunter_person_id, old.hunter_person_id);
  affected_year := coalesce(new.target_year, old.target_year);

  if affected_person_id is not null then
    update public.revenue_target_allocations target
    set amount = greatest(coalesce(target.own_amount, 0), 0)
      + public.get_studio_hunter_total_for_person(target.customer_id, target.person_id, target.target_year),
        updated_at = now()
    where target.customer_id = affected_customer_id
      and target.person_id = affected_person_id
      and target.target_year = affected_year
      and target.target_type = 'hunter';
  end if;

  if tg_op = 'UPDATE'
    and old.hunter_person_id is not null
    and old.hunter_person_id is distinct from new.hunter_person_id
  then
    update public.revenue_target_allocations target
    set amount = greatest(coalesce(target.own_amount, 0), 0)
      + public.get_studio_hunter_total_for_person(target.customer_id, target.person_id, target.target_year),
        updated_at = now()
    where target.customer_id = old.customer_id
      and target.person_id = old.hunter_person_id
      and target.target_year = old.target_year
      and target.target_type = 'hunter';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists studio_target_allocations_refresh_hunter_total
  on public.studio_target_allocations;

create trigger studio_target_allocations_refresh_hunter_total
after insert or update or delete
on public.studio_target_allocations
for each row
execute function public.refresh_hunter_total_from_studio();

update public.revenue_target_allocations target
set amount = greatest(coalesce(target.own_amount, 0), 0)
  + public.get_studio_hunter_total_for_person(target.customer_id, target.person_id, target.target_year)
where target.target_type = 'hunter';

alter table public.revenue_target_allocations
  drop constraint if exists revenue_target_allocations_own_amount_check;

alter table public.revenue_target_allocations
  add constraint revenue_target_allocations_own_amount_check
  check (own_amount is null or own_amount >= 0) not valid;

alter table public.revenue_target_allocations
  validate constraint revenue_target_allocations_own_amount_check;
