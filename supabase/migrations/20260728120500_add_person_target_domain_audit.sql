-- Domain audit trail for person/customer target allocations.
--
-- This increment audits only the editable person target source of truth:
-- public.revenue_target_allocations. It preserves the existing generic
-- audit_log trigger and does not change target save behavior.

do $$
begin
  if to_regclass('public.domain_audit_events') is null then
    raise exception 'Person target audit requires public.domain_audit_events from the access audit migration';
  end if;
end $$;

alter table public.domain_audit_events
  drop constraint if exists domain_audit_events_action_check;

alter table public.domain_audit_events
  add constraint domain_audit_events_action_check check (
    action in (
      'app_access.user.created',
      'app_access.user.updated',
      'app_access.user.deleted',
      'app_access.invite.created',
      'app_access.invite.updated',
      'app_access.invite.deleted',
      'person_target.created',
      'person_target.updated',
      'person_target.deleted'
    )
  );

create or replace function public.person_target_audit_payload(p_row jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_row is null then null
    else jsonb_build_object(
      'id', p_row ->> 'id',
      'customer_id', p_row ->> 'customer_id',
      'person_id', p_row ->> 'person_id',
      'target_type', p_row ->> 'target_type',
      'target_year', nullif(p_row ->> 'target_year', '')::integer,
      'amount', coalesce(nullif(p_row ->> 'amount', '')::numeric, 0),
      'own_amount', case
        when nullif(p_row ->> 'own_amount', '') is null then null
        else (p_row ->> 'own_amount')::numeric
      end
    )
  end
$$;

create or replace function public.audit_person_target_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_payload jsonb;
  v_new_payload jsonb;
  v_changed_fields text[];
  v_entity_id text;
  v_action text;
  v_source text;
  v_request_headers jsonb;
begin
  v_old_payload := public.person_target_audit_payload(
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end
  );
  v_new_payload := public.person_target_audit_payload(
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  select coalesce(array_agg(key order by key), '{}'::text[])
    into v_changed_fields
  from (
    select key
    from jsonb_object_keys(coalesce(v_old_payload, '{}'::jsonb) || coalesce(v_new_payload, '{}'::jsonb)) as keys(key)
    where (v_old_payload -> key) is distinct from (v_new_payload -> key)
  ) changed;

  if tg_op = 'UPDATE' and coalesce(array_length(v_changed_fields, 1), 0) = 0 then
    return new;
  end if;

  v_entity_id := coalesce(
    v_new_payload ->> 'id',
    v_old_payload ->> 'id',
    concat_ws(
      ':',
      coalesce(v_new_payload ->> 'customer_id', v_old_payload ->> 'customer_id'),
      coalesce(v_new_payload ->> 'person_id', v_old_payload ->> 'person_id'),
      coalesce(v_new_payload ->> 'target_type', v_old_payload ->> 'target_type'),
      coalesce(v_new_payload ->> 'target_year', v_old_payload ->> 'target_year')
    )
  );
  v_action := case
    when tg_op = 'INSERT' then 'person_target.created'
    when tg_op = 'UPDATE' then 'person_target.updated'
    when tg_op = 'DELETE' then 'person_target.deleted'
  end;
  v_source := coalesce(nullif(current_setting('app.audit_source', true), ''), 'db.trigger');
  v_request_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);

  insert into public.domain_audit_events (
    actor_user_id,
    actor_person_id,
    entity_type,
    entity_id,
    action,
    previous_values,
    new_values,
    changed_fields,
    source,
    correlation_id,
    request_id,
    metadata,
    status
  )
  values (
    auth.uid(),
    public.current_actor_person_id(),
    'person_target',
    v_entity_id,
    v_action,
    v_old_payload,
    v_new_payload,
    v_changed_fields,
    v_source,
    nullif(current_setting('app.audit_correlation_id', true), ''),
    nullif(v_request_headers ->> 'x-request-id', ''),
    jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'customer_id', coalesce(v_new_payload ->> 'customer_id', v_old_payload ->> 'customer_id'),
      'person_id', coalesce(v_new_payload ->> 'person_id', v_old_payload ->> 'person_id'),
      'target_type', coalesce(v_new_payload ->> 'target_type', v_old_payload ->> 'target_type'),
      'target_year', coalesce(v_new_payload ->> 'target_year', v_old_payload ->> 'target_year')
    ),
    'succeeded'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists revenue_target_allocations_domain_audit
  on public.revenue_target_allocations;

create trigger revenue_target_allocations_domain_audit
after insert or update or delete on public.revenue_target_allocations
for each row execute function public.audit_person_target_change();

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

  perform set_config('app.audit_source', 'rpc.remove_person_customer_targets', true);

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
    from pg_trigger
    where tgname = 'revenue_target_allocations_domain_audit'
  ) then
    raise exception 'Person target audit failed: domain audit trigger missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'domain_audit_events_action_check'
      and pg_get_constraintdef(oid) like '%person_target.updated%'
  ) then
    raise exception 'Person target audit failed: action constraint was not extended';
  end if;
end $$;
