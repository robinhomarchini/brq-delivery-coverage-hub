-- Repair optional e-mail semantics for people records.
--
-- The product allows creating organizational people without an e-mail address.
-- Keep e-mail validation when present, but do not require it for people rows.

alter table public.people alter column email drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'people_email_length_check'
      and conrelid = 'public.people'::regclass
  ) then
    alter table public.people drop constraint people_email_length_check;
  end if;

  alter table public.people add constraint people_email_length_check
    check (email is null or char_length(email) between 3 and 254);
end $$;

