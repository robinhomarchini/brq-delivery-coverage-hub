-- Make person_compensations tolerant to older clients that may send
-- updated_at = null during insert/upsert.

create or replace function public.touch_person_compensations_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = coalesce(new.updated_at, now());
  if tg_op = 'UPDATE' then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists person_compensations_updated_at on public.person_compensations;
create trigger person_compensations_updated_at
before insert or update on public.person_compensations
for each row execute function public.touch_person_compensations_updated_at();

notify pgrst, 'reload schema';
