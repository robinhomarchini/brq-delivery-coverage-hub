-- Persist the last imported customer Curve baseline separately from operational
-- targets. This is a read-only comparison photo and does not update customers,
-- people, or studio allocations by itself.

create table if not exists public.target_baseline_snapshots (
  id uuid primary key default gen_random_uuid(),
  baseline_year integer not null,
  file_name text not null,
  snapshot_rows jsonb not null default '[]'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists target_baseline_snapshots_year_created_idx
  on public.target_baseline_snapshots(baseline_year, created_at desc);

alter table public.target_baseline_snapshots enable row level security;

drop policy if exists "Active BRQ users read target baseline snapshots"
  on public.target_baseline_snapshots;
drop policy if exists "Editors manage target baseline snapshots"
  on public.target_baseline_snapshots;

revoke all on public.target_baseline_snapshots from anon;
grant select, insert on public.target_baseline_snapshots to authenticated;

create policy "Active BRQ users read target baseline snapshots"
on public.target_baseline_snapshots
for select
to authenticated
using (public.is_active_brq_user());

create policy "Editors manage target baseline snapshots"
on public.target_baseline_snapshots
for insert
to authenticated
with check (public.can_edit_delivery_data());

create or replace function public.set_target_baseline_snapshot_creator()
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

drop trigger if exists target_baseline_snapshots_creator
  on public.target_baseline_snapshots;
create trigger target_baseline_snapshots_creator
before insert on public.target_baseline_snapshots
for each row execute function public.set_target_baseline_snapshot_creator();

do $$
begin
  if to_regprocedure('public.audit_delivery_change()') is not null then
    drop trigger if exists target_baseline_snapshots_audit
      on public.target_baseline_snapshots;
    create trigger target_baseline_snapshots_audit
      after insert or update or delete on public.target_baseline_snapshots
      for each row execute function public.audit_delivery_change();
  end if;

  if to_regclass('public.target_baseline_snapshots') is null then
    raise exception 'target_baseline_snapshots table was not created';
  end if;
end $$;

notify pgrst, 'reload schema';
