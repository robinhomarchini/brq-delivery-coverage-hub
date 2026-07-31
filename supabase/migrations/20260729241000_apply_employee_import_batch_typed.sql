-- Typed successor for apply_employee_import_batch
--
-- Preserves the existing mutation behavior in the legacy JSON RPC and
-- exposes a stable, typed single-row contract so TypeScript can consume
-- explicit columns instead of casting jsonb payloads.

create or replace function public.apply_employee_import_batch_v2(
  p_batch_id uuid,
  p_manager_mappings jsonb
)
returns table (
  headcounts_updated integer,
  status text,
  salaries_updated integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_manage_person_compensation() then
    raise exception 'employee import access denied' using errcode = '42501';
  end if;

  result := public.apply_employee_import_batch(p_batch_id, p_manager_mappings);

  headcounts_updated := (result->>'headcounts_updated')::integer;
  status := result->>'status';
  salaries_updated := (result->>'salaries_updated')::integer;

  return next;
end;
$$;

revoke all on function public.apply_employee_import_batch_v2(uuid, jsonb) from public, anon;
grant execute on function public.apply_employee_import_batch_v2(uuid, jsonb) to authenticated;

do $$
begin
  if to_regprocedure('public.apply_employee_import_batch_v2(uuid,jsonb)') is null then
    raise exception 'employee import typed apply batch RPC was not created';
  end if;
end $$;

notify pgrst, 'reload schema';
