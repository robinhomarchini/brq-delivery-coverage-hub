-- Optional person classification. Existing rows remain NULL; area_id is unrelated.
-- Additive/forward-only: deploy this migration before the updated adapter.
set lock_timeout = '5s';

alter table public.people
  add column if not exists business_area text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.people'::regclass
      and conname = 'people_business_area_check'
  ) then
    alter table public.people
      add constraint people_business_area_check
        check (business_area in ('Vendas', 'Delivery', 'Outras'));
  end if;
end;
$$;

-- The existing Hunter own-person UPDATE policy covers every column. Protect the
-- new classification for direct PostgREST writes as well as RPC calls.
create or replace function public.guard_person_business_area()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.business_area is null then
      return new;
    end if;
  elsif new.business_area is not distinct from old.business_area then
    return new;
  end if;

  if not coalesce(public.can_write_delivery_hardening(), false) then
    raise exception 'Somente administradores e editores podem alterar a area de atuacao.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_person_business_area() from public, anon;

drop trigger if exists people_guard_business_area on public.people;
create trigger people_guard_business_area
before insert or update of business_area on public.people
for each row execute function public.guard_person_business_area();

-- Keep the original 14-parameter signature untouched for older clients. All
-- parameters here are required so PostgREST can resolve either overload exactly.
create or replace function public.save_person_with_assignments(
  p_id text,
  p_name text,
  p_email text,
  p_job_title text,
  p_director_id text,
  p_manager_id text,
  p_role_type text,
  p_area_id text,
  p_photo_url text,
  p_notes text,
  p_active boolean,
  p_is_manager boolean,
  p_hierarchy_level integer,
  p_customer_ids text[],
  p_business_area text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_can_edit boolean := coalesce(public.can_write_delivery_hardening(), false);
  v_business_area text;
begin
  if p_business_area is not null and p_business_area not in ('Vendas', 'Delivery', 'Outras') then
    raise exception 'Area de atuacao invalida: %', p_business_area using errcode = '23514';
  end if;

  if not v_can_edit then
    if public.current_hunter_access_person_id() is distinct from p_id or p_id is null then
      raise exception 'Consulta Hunter so pode salvar a propria pessoa.' using errcode = '42501';
    end if;
    select business_area into v_business_area
      from public.people where id = p_id for update;
    if not found or v_business_area is distinct from p_business_area then
      raise exception 'Consulta Hunter nao pode alterar a area de atuacao.' using errcode = '42501';
    end if;
  end if;

  perform public.save_person_with_assignments(
    p_id, p_name, p_email, p_job_title, p_director_id, p_manager_id,
    p_role_type, p_area_id, p_photo_url, p_notes, p_active, p_is_manager,
    p_hierarchy_level, p_customer_ids
  );

  if v_can_edit then
    update public.people
      set business_area = p_business_area
      where id = p_id and business_area is distinct from p_business_area;
  end if;
end;
$$;

revoke all on function public.save_person_with_assignments(
  text, text, text, text, text, text, text, text, text, text, boolean, boolean, integer, text[], text
) from public, anon;
grant execute on function public.save_person_with_assignments(
  text, text, text, text, text, text, text, text, text, text, boolean, boolean, integer, text[], text
) to authenticated;

comment on column public.people.business_area is
  'Optional person classification: Vendas, Delivery, Outras; NULL means not informed, independently of area_id.';

reset lock_timeout;
