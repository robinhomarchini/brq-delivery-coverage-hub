-- Allow deleting an Area/Studio without breaking legacy territory rows.
--
-- Areas/Studios are a classification dimension. When an area is deleted,
-- dependent people and territories should become unclassified instead of
-- blocking the user with a foreign-key error.

do $$
begin
  if to_regclass('public.territories') is not null then
    alter table public.territories
      alter column area_id drop not null;

    alter table public.territories
      drop constraint if exists territories_area_id_fkey;

    alter table public.territories
      add constraint territories_area_id_fkey
      foreign key (area_id)
      references public.areas(id)
      on delete set null;
  end if;
end $$;
