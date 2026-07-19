-- Allow an optional managerial amount override for Hunter Especializado.
--
-- This value is reporting-only. It does not create or update official
-- revenue_target_allocations, customer targets or studio target allocations.

alter table public.specialist_hunter_studio_assignments
  add column if not exists assigned_amount numeric(14,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'specialist_hunter_studio_assignments_assigned_amount_check'
      and conrelid = 'public.specialist_hunter_studio_assignments'::regclass
  ) then
    alter table public.specialist_hunter_studio_assignments
      add constraint specialist_hunter_studio_assignments_assigned_amount_check
      check (assigned_amount is null or assigned_amount >= 0);
  end if;
end $$;

create or replace function public.save_specialist_hunter_studio_assignments(
  p_person_id text,
  p_customer_id text,
  p_target_year integer,
  p_studio_target_allocation_ids text[] default '{}',
  p_assigned_amounts jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_ids text[] := coalesce(p_studio_target_allocation_ids, '{}');
  assigned_amounts jsonb := coalesce(p_assigned_amounts, '{}'::jsonb);
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

  if exists (
    select 1
    from jsonb_each_text(assigned_amounts) amount_by_id(studio_id, amount_text)
    where amount_by_id.studio_id <> all(selected_ids)
       or nullif(amount_by_id.amount_text, '')::numeric < 0
  ) then
    raise exception 'Valor gerencial inválido na seleção de Hunter Especializado.'
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
    assigned_amount,
    notes
  )
  select
    p_person_id,
    selected.id,
    p_target_year,
    case
      when assigned_amounts ? selected.id then greatest((assigned_amounts ->> selected.id)::numeric, 0)
      else null
    end,
    case
      when assigned_amounts ? selected.id then 'Meta gerencial com valor ajustado para Hunter Especializado.'
      else 'Meta gerencial derivada de Studio para Hunter Especializado.'
    end
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
      assigned_amount = excluded.assigned_amount,
      notes = excluded.notes,
      updated_at = now();
end;
$$;

grant execute on function public.save_specialist_hunter_studio_assignments(text, text, integer, text[], jsonb) to authenticated;

notify pgrst, 'reload schema';
