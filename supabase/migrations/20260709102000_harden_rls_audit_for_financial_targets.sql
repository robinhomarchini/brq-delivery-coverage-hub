-- Harden RLS and audit coverage for target and relationship tables.
--
-- This migration keeps Supabase/RLS as the production enforcement layer while
-- closing older broad authenticated-user policies left from homologation.

create or replace function public.can_write_delivery_hardening()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_delivery_data();
$$;

grant execute on function public.can_write_delivery_hardening() to authenticated;

do $$
begin
  if to_regclass('public.person_customer_assignments') is not null then
    alter table public.person_customer_assignments enable row level security;

    drop policy if exists "Authenticated users read person customer assignments"
      on public.person_customer_assignments;
    drop policy if exists "Authenticated users manage person customer assignments"
      on public.person_customer_assignments;
    drop policy if exists "Active BRQ users read person customer assignments"
      on public.person_customer_assignments;
    drop policy if exists "Editors manage person customer assignments"
      on public.person_customer_assignments;

    revoke all on public.person_customer_assignments from anon;
    grant select, insert, update, delete on public.person_customer_assignments to authenticated;

    create policy "Active BRQ users read person customer assignments"
    on public.person_customer_assignments
    for select
    to authenticated
    using (public.is_active_brq_user());

    create policy "Editors manage person customer assignments"
    on public.person_customer_assignments
    for all
    to authenticated
    using (public.can_edit_delivery_data())
    with check (public.can_edit_delivery_data());
  end if;

  if to_regclass('public.revenue_target_allocations') is not null then
    alter table public.revenue_target_allocations enable row level security;

    drop policy if exists "Authenticated users read revenue target allocations"
      on public.revenue_target_allocations;
    drop policy if exists "Authenticated users manage revenue target allocations"
      on public.revenue_target_allocations;
    drop policy if exists "Active BRQ users read revenue target allocations"
      on public.revenue_target_allocations;
    drop policy if exists "Editors manage revenue target allocations"
      on public.revenue_target_allocations;

    revoke all on public.revenue_target_allocations from anon;
    grant select, insert, update, delete on public.revenue_target_allocations to authenticated;

    create policy "Active BRQ users read revenue target allocations"
    on public.revenue_target_allocations
    for select
    to authenticated
    using (public.is_active_brq_user());

    create policy "Editors manage revenue target allocations"
    on public.revenue_target_allocations
    for all
    to authenticated
    using (public.can_edit_delivery_data())
    with check (public.can_edit_delivery_data());
  end if;

  if to_regclass('public.studio_target_allocations') is not null then
    alter table public.studio_target_allocations enable row level security;

    drop policy if exists "Authenticated users read studio target allocations"
      on public.studio_target_allocations;
    drop policy if exists "Authenticated users manage studio target allocations"
      on public.studio_target_allocations;
    drop policy if exists "Active BRQ users read studio target allocations"
      on public.studio_target_allocations;
    drop policy if exists "Editors manage studio target allocations"
      on public.studio_target_allocations;

    revoke all on public.studio_target_allocations from anon;
    grant select, insert, update, delete on public.studio_target_allocations to authenticated;

    create policy "Active BRQ users read studio target allocations"
    on public.studio_target_allocations
    for select
    to authenticated
    using (public.is_active_brq_user());

    create policy "Editors manage studio target allocations"
    on public.studio_target_allocations
    for all
    to authenticated
    using (public.can_edit_delivery_data())
    with check (public.can_edit_delivery_data());
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.audit_delivery_change()') is not null then
    if to_regclass('public.person_compensations') is not null then
      drop trigger if exists person_compensations_audit on public.person_compensations;
      create trigger person_compensations_audit
        after insert or update or delete on public.person_compensations
        for each row execute function public.audit_delivery_change();
    end if;

    if to_regclass('public.studio_target_allocations') is not null then
      drop trigger if exists studio_target_allocations_audit on public.studio_target_allocations;
      create trigger studio_target_allocations_audit
        after insert or update or delete on public.studio_target_allocations
        for each row execute function public.audit_delivery_change();
    end if;

    if to_regclass('public.specialist_hunter_studio_assignments') is not null then
      drop trigger if exists specialist_hunter_studio_assignments_audit on public.specialist_hunter_studio_assignments;
      create trigger specialist_hunter_studio_assignments_audit
        after insert or update or delete on public.specialist_hunter_studio_assignments
        for each row execute function public.audit_delivery_change();
    end if;

    if to_regclass('public.studio_baseline_snapshots') is not null then
      drop trigger if exists studio_baseline_snapshots_audit on public.studio_baseline_snapshots;
      create trigger studio_baseline_snapshots_audit
        after insert or update or delete on public.studio_baseline_snapshots
        for each row execute function public.audit_delivery_change();
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('person_customer_assignments', 'revenue_target_allocations', 'studio_target_allocations')
      and policyname like 'Authenticated users %'
  ) then
    raise exception 'RLS hardening failed: broad authenticated policies still exist';
  end if;

  if to_regclass('public.person_customer_assignments') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'person_customer_assignments'
      and policyname = 'Editors manage person customer assignments'
  ) then
    raise exception 'RLS hardening failed: person_customer_assignments editor policy missing';
  end if;

  if to_regclass('public.revenue_target_allocations') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'revenue_target_allocations'
      and policyname = 'Editors manage revenue target allocations'
  ) then
    raise exception 'RLS hardening failed: revenue_target_allocations editor policy missing';
  end if;

  if to_regclass('public.studio_target_allocations') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_target_allocations'
      and policyname = 'Editors manage studio target allocations'
  ) then
    raise exception 'RLS hardening failed: studio_target_allocations editor policy missing';
  end if;
end $$;

notify pgrst, 'reload schema';
