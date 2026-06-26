-- Allow BRQ internal validators to use the homologation app without app-user pre-provisioning.
-- The frontend blocks non-BRQ domains; this function mirrors that boundary in RLS.
create or replace function public.is_authenticated_brq_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@brq.com';
$$;

grant execute on function public.is_authenticated_brq_email() to authenticated;

do $$
declare
  table_name text;
  qualified_table text;
begin
  foreach table_name in array array[
    'areas',
    'people',
    'territories',
    'customers',
    'subjects',
    'person_customer_assignments',
    'revenue_target_allocations',
    'portfolio_directors',
    'portfolio_delivery_managers',
    'revenue_plans'
  ]
  loop
    qualified_table := format('public.%I', table_name);

    if to_regclass(qualified_table) is not null then
      execute format('alter table %s enable row level security', qualified_table);
      execute format('grant select, insert, update, delete on %s to authenticated', qualified_table);
      execute format('drop policy if exists "BRQ homologation manage %s" on %s', table_name, qualified_table);
      execute format(
        'create policy "BRQ homologation manage %s" on %s for all to authenticated using (public.is_authenticated_brq_email()) with check (public.is_authenticated_brq_email())',
        table_name,
        qualified_table
      );
    end if;
  end loop;
end $$;
