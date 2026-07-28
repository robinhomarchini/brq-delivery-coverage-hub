-- Domain audit trail for application access administration.
--
-- This first increment audits only the access-profile capability backed by
-- app_users and app_access_invites. The event model is generic enough for
-- future domain capabilities, but no other table is wired in this migration.

create table if not exists public.domain_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_person_id text references public.people(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  previous_values jsonb,
  new_values jsonb,
  changed_fields text[] not null default '{}',
  source text not null,
  correlation_id text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'succeeded',
  error_category text,
  created_at timestamptz not null default now(),
  constraint domain_audit_events_action_check check (
    action in (
      'app_access.user.created',
      'app_access.user.updated',
      'app_access.user.deleted',
      'app_access.invite.created',
      'app_access.invite.updated',
      'app_access.invite.deleted'
    )
  ),
  constraint domain_audit_events_status_check check (status in ('succeeded', 'failed'))
);

create index if not exists domain_audit_events_entity_idx
  on public.domain_audit_events(entity_type, entity_id, occurred_at desc);

create index if not exists domain_audit_events_actor_idx
  on public.domain_audit_events(actor_user_id, occurred_at desc);

alter table public.domain_audit_events enable row level security;
revoke all on public.domain_audit_events from anon;
revoke all on public.domain_audit_events from authenticated;
grant select on public.domain_audit_events to authenticated;

drop policy if exists "Admins read domain audit events" on public.domain_audit_events;
create policy "Admins read domain audit events"
on public.domain_audit_events
for select
to authenticated
using (public.is_delivery_admin());

create or replace function public.current_actor_person_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.people p
  where lower(p.email) = lower(public.current_auth_email())
    and p.active
  order by p.id
  limit 1
$$;

grant execute on function public.current_actor_person_id() to authenticated;

create or replace function public.app_access_audit_payload(p_table_name text, p_row jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_row is null then null
    when p_table_name = 'app_users' then jsonb_build_object(
      'user_id', p_row ->> 'user_id',
      'email', lower(coalesce(p_row ->> 'email', '')),
      'role', p_row ->> 'role',
      'active', coalesce((p_row ->> 'active')::boolean, false)
    )
    when p_table_name = 'app_access_invites' then jsonb_build_object(
      'email', lower(coalesce(p_row ->> 'email', '')),
      'role', p_row ->> 'role',
      'active', coalesce((p_row ->> 'active')::boolean, false),
      'accepted_at', p_row ->> 'accepted_at'
    )
    else '{}'::jsonb
  end
$$;

create or replace function public.audit_app_access_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_payload jsonb;
  v_new_payload jsonb;
  v_changed_fields text[];
  v_entity_type text;
  v_entity_id text;
  v_action text;
  v_source text;
  v_request_headers jsonb;
begin
  v_old_payload := public.app_access_audit_payload(tg_table_name, case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end);
  v_new_payload := public.app_access_audit_payload(tg_table_name, case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end);

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

  v_entity_type := case
    when tg_table_name = 'app_users' then 'app_access.user'
    when tg_table_name = 'app_access_invites' then 'app_access.invite'
    else tg_table_name
  end;
  v_entity_id := coalesce(v_new_payload ->> 'email', v_old_payload ->> 'email', v_new_payload ->> 'user_id', v_old_payload ->> 'user_id');
  v_action := case
    when tg_table_name = 'app_users' and tg_op = 'INSERT' then 'app_access.user.created'
    when tg_table_name = 'app_users' and tg_op = 'UPDATE' then 'app_access.user.updated'
    when tg_table_name = 'app_users' and tg_op = 'DELETE' then 'app_access.user.deleted'
    when tg_table_name = 'app_access_invites' and tg_op = 'INSERT' then 'app_access.invite.created'
    when tg_table_name = 'app_access_invites' and tg_op = 'UPDATE' then 'app_access.invite.updated'
    when tg_table_name = 'app_access_invites' and tg_op = 'DELETE' then 'app_access.invite.deleted'
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
    v_entity_type,
    v_entity_id,
    v_action,
    v_old_payload,
    v_new_payload,
    v_changed_fields,
    v_source,
    nullif(current_setting('app.audit_correlation_id', true), ''),
    nullif(v_request_headers ->> 'x-request-id', ''),
    jsonb_build_object('table', tg_table_name, 'operation', tg_op),
    'succeeded'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists app_users_domain_audit on public.app_users;
create trigger app_users_domain_audit
after insert or update or delete on public.app_users
for each row execute function public.audit_app_access_profile_change();

drop trigger if exists app_access_invites_domain_audit on public.app_access_invites;
create trigger app_access_invites_domain_audit
after insert or update or delete on public.app_access_invites
for each row execute function public.audit_app_access_profile_change();

create or replace function public.upsert_app_access(
  p_email text,
  p_role text,
  p_active boolean default true
)
returns table (
  user_id uuid,
  email text,
  role text,
  active boolean,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_active boolean := coalesce(p_active, false);
  v_existing_is_admin boolean := false;
begin
  if not public.is_delivery_admin() then
    raise exception 'Apenas administradores podem gerenciar acessos.'
      using errcode = '42501';
  end if;

  perform set_config('app.audit_source', 'rpc.upsert_app_access', true);

  if not public.is_brq_email(v_email) then
    raise exception 'Informe um e-mail corporativo @brq.com.'
      using errcode = '22023';
  end if;

  if v_role not in ('viewer', 'hunter_viewer', 'editor', 'admin') then
    raise exception 'Papel de acesso inválido: %', p_role
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.list_app_access() as access_row
    where lower(access_row.email) = v_email
      and access_row.role = 'admin'
      and access_row.active
  ) into v_existing_is_admin;

  if v_existing_is_admin
     and (v_role <> 'admin' or not v_active)
     and public.count_other_active_delivery_admins(v_email) < 1 then
    raise exception 'Mantenha ao menos um administrador ativo.'
      using errcode = '22023';
  end if;

  insert into public.app_access_invites as invite (email, role, active, invited_by)
  values (v_email, v_role, v_active, auth.uid())
  on conflict on constraint app_access_invites_pkey do update
  set role = excluded.role,
      active = excluded.active,
      invited_by = auth.uid(),
      updated_at = now();

  update public.app_users as app_user
  set role = v_role,
      active = v_active,
      updated_at = now()
  where lower(app_user.email) = v_email;

  return query
  select
    access_row.user_id,
    access_row.email,
    access_row.role,
    access_row.active,
    access_row.status,
    access_row.created_at,
    access_row.updated_at
  from public.list_app_access() as access_row
  where lower(access_row.email) = v_email;
end;
$$;

create or replace function public.delete_app_access(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  existing_is_admin boolean := false;
begin
  if not public.is_delivery_admin() then
    raise exception 'Apenas administradores podem excluir acessos.'
      using errcode = '42501';
  end if;

  perform set_config('app.audit_source', 'rpc.delete_app_access', true);

  if not public.is_brq_email(normalized_email) then
    raise exception 'Informe um e-mail corporativo @brq.com.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.list_app_access() access_row
    where lower(access_row.email) = normalized_email
      and access_row.role = 'admin'
      and access_row.active
  ) into existing_is_admin;

  if existing_is_admin and public.count_other_active_delivery_admins(normalized_email) < 1 then
    raise exception 'Mantenha ao menos um administrador ativo.'
      using errcode = '22023';
  end if;

  delete from public.app_access_invites i
  where lower(i.email) = normalized_email;

  delete from public.app_users u
  where lower(u.email) = normalized_email;
end;
$$;

grant execute on function public.upsert_app_access(text, text, boolean) to authenticated;
grant execute on function public.delete_app_access(text) to authenticated;

do $$
begin
  if (
    select count(*)
    from pg_trigger
    where tgname in ('app_users_domain_audit', 'app_access_invites_domain_audit')
  ) <> 2 then
    raise exception 'Access audit failed: domain audit triggers missing';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'domain_audit_events'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Access audit failed: audit events are not append-only for app users';
  end if;
end $$;
