create or replace function public.remove_person_customer_targets(
  p_customer_id text,
  p_person_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_customer_id), '') is null then
    raise exception 'Customer id is required';
  end if;

  if nullif(trim(p_person_id), '') is null then
    raise exception 'Person id is required';
  end if;

  delete from public.revenue_target_allocations
  where customer_id = p_customer_id
    and person_id = p_person_id;

  delete from public.person_customer_assignments
  where customer_id = p_customer_id
    and person_id = p_person_id;
end;
$$;

grant execute on function public.remove_person_customer_targets(text, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'remove_person_customer_targets'
  ) then
    raise exception 'remove_person_customer_targets RPC was not created';
  end if;
end $$;
