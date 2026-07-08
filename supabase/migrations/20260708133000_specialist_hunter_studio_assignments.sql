-- Persist the managerial selection of Studio allocations for Hunter Especializado.
--
-- This relation does not create official revenue targets. It only records which
-- normalized Studio allocation rows compose the specialist hunter managerial view.

create table if not exists public.specialist_hunter_studio_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references public.people(id) on delete cascade,
  studio_target_allocation_id text not null references public.studio_target_allocations(id) on delete cascade,
  target_year integer not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint specialist_hunter_studio_assignments_unique unique (person_id, studio_target_allocation_id)
);

create index if not exists specialist_hunter_studio_assignments_person_year_idx
  on public.specialist_hunter_studio_assignments(person_id, target_year);

create index if not exists specialist_hunter_studio_assignments_studio_idx
  on public.specialist_hunter_studio_assignments(studio_target_allocation_id);

create or replace function public.validate_specialist_hunter_studio_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  allocation_year integer;
begin
  select role_type
    into assigned_role
  from public.people
  where id = new.person_id;

  if assigned_role is distinct from 'Hunter Especializado' then
    raise exception 'Apenas Hunter Especializado pode receber seleção gerencial de Studios.'
      using errcode = '23514';
  end if;

  select target_year
    into allocation_year
  from public.studio_target_allocations
  where id = new.studio_target_allocation_id;

  if allocation_year is null then
    raise exception 'Meta de Studio não encontrada: %', new.studio_target_allocation_id
      using errcode = '23503';
  end if;

  if allocation_year <> new.target_year then
    raise exception 'Ano da seleção não confere com a meta de Studio.'
      using errcode = '23514';
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists specialist_hunter_studio_assignments_validate
  on public.specialist_hunter_studio_assignments;

create trigger specialist_hunter_studio_assignments_validate
before insert or update
on public.specialist_hunter_studio_assignments
for each row execute function public.validate_specialist_hunter_studio_assignment();

alter table public.specialist_hunter_studio_assignments enable row level security;

drop policy if exists "Active BRQ users read specialist hunter studio assignments"
  on public.specialist_hunter_studio_assignments;
drop policy if exists "Editors manage specialist hunter studio assignments"
  on public.specialist_hunter_studio_assignments;

revoke all on public.specialist_hunter_studio_assignments from anon;
grant select, insert, update, delete on public.specialist_hunter_studio_assignments to authenticated;

create policy "Active BRQ users read specialist hunter studio assignments"
on public.specialist_hunter_studio_assignments
for select
to authenticated
using (public.is_active_brq_user());

create policy "Editors manage specialist hunter studio assignments"
on public.specialist_hunter_studio_assignments
for all
to authenticated
using (public.can_edit_delivery_data())
with check (public.can_edit_delivery_data());

create or replace function public.save_specialist_hunter_studio_assignments(
  p_person_id text,
  p_customer_id text,
  p_target_year integer,
  p_studio_target_allocation_ids text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_ids text[] := coalesce(p_studio_target_allocation_ids, '{}');
begin
  if not public.can_edit_delivery_data() then
    raise exception 'Sem permissão para salvar metas gerenciais de Hunter Especializado.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.people
    where id = p_person_id
      and role_type = 'Hunter Especializado'
      and active = true
  ) then
    raise exception 'Selecione uma pessoa ativa com perfil Hunter Especializado.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(selected_ids) selected(id)
    left join public.studio_target_allocations studio
      on studio.id = selected.id
     and studio.customer_id = p_customer_id
     and studio.target_year = p_target_year
    where studio.id is null
  ) then
    raise exception 'A seleção contém meta de Studio fora do cliente/ano escolhido.'
      using errcode = '23514';
  end if;

  delete from public.specialist_hunter_studio_assignments assignment
  using public.studio_target_allocations studio
  where assignment.studio_target_allocation_id = studio.id
    and assignment.person_id = p_person_id
    and assignment.target_year = p_target_year
    and studio.customer_id = p_customer_id;

  insert into public.specialist_hunter_studio_assignments(
    person_id,
    studio_target_allocation_id,
    target_year,
    notes
  )
  select
    p_person_id,
    selected.id,
    p_target_year,
    'Meta gerencial derivada de Studio para Hunter Especializado.'
  from (
    select distinct unnest(selected_ids) as id
  ) selected
  join public.studio_target_allocations studio
    on studio.id = selected.id
   and studio.customer_id = p_customer_id
   and studio.target_year = p_target_year
  where coalesce(studio.hunter_amount, 0) + coalesce(studio.maintenance_amount, 0) > 0
  on conflict (person_id, studio_target_allocation_id) do update
  set target_year = excluded.target_year,
      notes = excluded.notes,
      updated_at = now();
end;
$$;

grant execute on function public.save_specialist_hunter_studio_assignments(text, text, integer, text[]) to authenticated;

do $$
begin
  if to_regclass('public.specialist_hunter_studio_assignments') is null then
    raise exception 'specialist_hunter_studio_assignments table was not created';
  end if;
end $$;

notify pgrst, 'reload schema';
