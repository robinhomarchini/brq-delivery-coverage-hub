-- Persist executive snapshots of Studio baseline comparisons.
--
-- Source of truth: each row is an immutable photo of a calculated comparison
-- at the time the user clicks "Salvar foto do resultado". It does not update
-- customers, person targets or studio allocations.

create table if not exists public.studio_baseline_snapshots (
  id uuid primary key default gen_random_uuid(),
  baseline_year integer not null,
  file_name text not null,
  snapshot_rows jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists studio_baseline_snapshots_year_created_idx
  on public.studio_baseline_snapshots(baseline_year, created_at desc);

alter table public.studio_baseline_snapshots enable row level security;

drop policy if exists "Active BRQ users read studio baseline snapshots" on public.studio_baseline_snapshots;
drop policy if exists "Editors manage studio baseline snapshots" on public.studio_baseline_snapshots;

revoke all on public.studio_baseline_snapshots from anon;
grant select, insert on public.studio_baseline_snapshots to authenticated;

create policy "Active BRQ users read studio baseline snapshots"
on public.studio_baseline_snapshots
for select
to authenticated
using (public.is_active_brq_user());

create policy "Editors manage studio baseline snapshots"
on public.studio_baseline_snapshots
for insert
to authenticated
with check (public.can_edit_delivery_data());

create or replace function public.set_studio_baseline_snapshot_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists studio_baseline_snapshots_creator on public.studio_baseline_snapshots;
create trigger studio_baseline_snapshots_creator
before insert on public.studio_baseline_snapshots
for each row execute function public.set_studio_baseline_snapshot_creator();

do $$
begin
  if to_regclass('public.studio_baseline_snapshots') is null then
    raise exception 'studio_baseline_snapshots table was not created';
  end if;
end $$;

notify pgrst, 'reload schema';
