-- Harden app access management with invite-based provisioning and RBAC RLS.
--
-- Source of truth:
-- - app_users: authenticated users that already reached the app;
-- - app_access_invites: admin-managed pre-registration for pending users.

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_access_invites (
  email text primary key,
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_email_idx on public.app_users(lower(email));
create index if not exists app_access_invites_active_idx on public.app_access_invites(active);

create or replace function public.is_brq_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) ~ '^[^@]+@brq\.com$';
$$;

create or replace function public.current_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.is_authenticated_brq_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.is_brq_email(public.current_auth_email());
$$;

create or replace function public.is_active_brq_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_authenticated_brq_email()
    and exists (
      select 1
      from public.app_users
      where user_id = auth.uid()
        and active
        and public.is_brq_email(email)
    );
$$;

create or replace function public.can_edit_delivery_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_brq_user()
    and exists (
      select 1
      from public.app_users
      where user_id = auth.uid()
        and active
        and role in ('editor', 'admin')
    );
$$;

create or replace function public.is_delivery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_brq_user()
    and exists (
      select 1
      from public.app_users
      where user_id = auth.uid()
        and active
        and role = 'admin'
    );
$$;

create or replace function public.handle_new_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  invite_record record;
  next_role text := 'viewer';
  next_active boolean := false;
begin
  if normalized_email = 'robinson.marchini@brq.com' then
    next_role := 'admin';
    next_active := true;
  elsif public.is_brq_email(normalized_email) then
    select role, active
      into invite_record
      from public.app_access_invites
      where email = normalized_email
      limit 1;

    if found then
      next_role := invite_record.role;
      next_active := invite_record.active;
    end if;
  end if;

  insert into public.app_users(user_id, email, role, active)
  values (new.id, normalized_email, next_role, next_active)
  on conflict (user_id) do update
  set email = excluded.email,
      role = case
        when excluded.email = 'robinson.marchini@brq.com' then 'admin'
        when public.app_users.email = 'robinson.marchini@brq.com' then 'admin'
        else excluded.role
      end,
      active = case
        when excluded.email = 'robinson.marchini@brq.com' then true
        else excluded.active
      end,
      updated_at = now();

  if next_active and public.is_brq_email(normalized_email) then
    update public.app_access_invites
    set accepted_at = coalesce(accepted_at, now()),
        updated_at = now()
    where email = normalized_email;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_app_user();

insert into public.app_access_invites(email, role, active)
values ('robinson.marchini@brq.com', 'admin', true)
on conflict (email) do update
set role = 'admin',
    active = true,
    updated_at = now();

insert into public.app_users(user_id, email, role, active)
select
  id,
  lower(trim(coalesce(email, ''))),
  case when lower(trim(coalesce(email, ''))) = 'robinson.marchini@brq.com' then 'admin' else 'viewer' end,
  lower(trim(coalesce(email, ''))) = 'robinson.marchini@brq.com'
from auth.users
where lower(trim(coalesce(email, ''))) = 'robinson.marchini@brq.com'
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin',
    active = true,
    updated_at = now();

update public.app_users
set email = lower(trim(email)),
    role = case
      when lower(trim(email)) = 'robinson.marchini@brq.com' then 'admin'
      when role in ('viewer', 'editor', 'admin') then role
      else 'viewer'
    end,
    active = case
      when lower(trim(email)) = 'robinson.marchini@brq.com' then true
      when not public.is_brq_email(email) then false
      else active
    end,
    updated_at = now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'app_users_active_brq_email_check') then
    alter table public.app_users
      add constraint app_users_active_brq_email_check
      check (not active or lower(email) ~ '^[^@]+@brq\.com$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'app_access_invites_brq_email_check') then
    alter table public.app_access_invites
      add constraint app_access_invites_brq_email_check
      check (lower(email) ~ '^[^@]+@brq\.com$');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_updated_at on public.app_users;
create trigger app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists app_access_invites_updated_at on public.app_access_invites;
create trigger app_access_invites_updated_at
before update on public.app_access_invites
for each row execute function public.set_updated_at();

create or replace function public.accept_current_app_access()
returns table (
  user_id uuid,
  email text,
  role text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := public.current_auth_email();
  next_role text;
  next_active boolean;
begin
  if current_user_id is null then
    return;
  end if;

  if not public.is_brq_email(normalized_email) then
    insert into public.app_users(user_id, email, role, active)
    values (current_user_id, normalized_email, 'viewer', false)
    on conflict (user_id) do update
    set email = excluded.email,
        active = false,
        updated_at = now();
    return;
  end if;

  select i.role, i.active
    into next_role, next_active
    from public.app_access_invites i
    where i.email = normalized_email
    limit 1;

  if normalized_email = 'robinson.marchini@brq.com' then
    next_role := 'admin';
    next_active := true;
  end if;

  if next_role is not null then
    insert into public.app_users(user_id, email, role, active)
    values (current_user_id, normalized_email, next_role, next_active)
    on conflict (user_id) do update
    set email = excluded.email,
        role = case when excluded.email = 'robinson.marchini@brq.com' then 'admin' else excluded.role end,
        active = case when excluded.email = 'robinson.marchini@brq.com' then true else excluded.active end,
        updated_at = now();

    if next_active then
      update public.app_access_invites i
      set accepted_at = coalesce(i.accepted_at, now()),
          updated_at = now()
      where i.email = normalized_email;
    end if;
  elsif not exists (select 1 from public.app_users u where u.user_id = current_user_id) then
    insert into public.app_users(user_id, email, role, active)
    values (current_user_id, normalized_email, 'viewer', false);
  else
    update public.app_users u
    set email = normalized_email,
        active = case when public.is_brq_email(normalized_email) then u.active else false end,
        updated_at = now()
    where u.user_id = current_user_id;
  end if;

  return query
  select u.user_id, u.email, u.role, u.active, u.created_at, u.updated_at
  from public.app_users u
  where u.user_id = current_user_id;
end;
$$;

create or replace function public.list_app_access()
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
begin
  if not public.is_delivery_admin() then
    raise exception 'Apenas administradores podem listar acessos.'
      using errcode = '42501';
  end if;

  return query
  with invite_rows as (
    select
      null::uuid as user_id,
      i.email,
      i.role,
      i.active,
      'pending'::text as status,
      i.created_at,
      i.updated_at
    from public.app_access_invites i
    where not exists (select 1 from public.app_users u where u.email = i.email)
  )
  select
    u.user_id,
    u.email,
    u.role,
    u.active,
    'active'::text as status,
    u.created_at,
    u.updated_at
  from public.app_users u
  where public.is_brq_email(u.email)
  union all
  select *
  from invite_rows
  order by email;
end;
$$;

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
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_role text := lower(trim(coalesce(p_role, '')));
begin
  if not public.is_delivery_admin() then
    raise exception 'Apenas administradores podem gerenciar acessos.'
      using errcode = '42501';
  end if;

  if not public.is_brq_email(normalized_email) then
    raise exception 'Informe um e-mail corporativo @brq.com.'
      using errcode = '22023';
  end if;

  if normalized_role not in ('viewer', 'editor', 'admin') then
    raise exception 'Papel de acesso inválido: %', p_role
      using errcode = '22023';
  end if;

  if normalized_email = 'robinson.marchini@brq.com' and (normalized_role <> 'admin' or not p_active) then
    raise exception 'O administrador inicial deve permanecer ativo como admin.'
      using errcode = '22023';
  end if;

  insert into public.app_access_invites(email, role, active, invited_by)
  values (normalized_email, normalized_role, p_active, auth.uid())
  on conflict (email) do update
  set role = excluded.role,
      active = excluded.active,
      invited_by = auth.uid(),
      updated_at = now();

  update public.app_users u
  set role = normalized_role,
      active = p_active,
      updated_at = now()
  where u.email = normalized_email;

  return query
  select access_row.*
  from public.list_app_access() as access_row
  where access_row.email = normalized_email;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['app_users', 'app_access_invites']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Authenticated users read %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Authenticated users manage %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Authenticated users read own access" on public.%I', table_name);
    execute format('drop policy if exists "Authenticated users manage own access" on public.%I', table_name);
    execute format('drop policy if exists "Users read own access" on public.%I', table_name);
    execute format('drop policy if exists "Admins manage access" on public.%I', table_name);
    execute format('drop policy if exists "Admins read access invites" on public.%I', table_name);
    execute format('drop policy if exists "Admins manage access invites" on public.%I', table_name);
  end loop;
end $$;

revoke all on public.app_users, public.app_access_invites from anon;
grant select, insert, update, delete on public.app_users, public.app_access_invites to authenticated;

create policy "Users read own access"
on public.app_users for select to authenticated
using (user_id = auth.uid() or public.is_delivery_admin());

create policy "Admins manage access"
on public.app_users for all to authenticated
using (public.is_delivery_admin())
with check (public.is_delivery_admin());

create policy "Admins read access invites"
on public.app_access_invites for select to authenticated
using (public.is_delivery_admin());

create policy "Admins manage access invites"
on public.app_access_invites for all to authenticated
using (public.is_delivery_admin())
with check (public.is_delivery_admin());

do $$
declare
  table_name text;
  qualified_table text;
  readable_name text;
begin
  foreach table_name in array array[
    'areas',
    'people',
    'territories',
    'customers',
    'subjects',
    'person_customer_assignments',
    'revenue_target_allocations',
    'customer_target_years',
    'studio_target_allocations',
    'portfolio_directors',
    'portfolio_delivery_managers',
    'revenue_plans'
  ]
  loop
    qualified_table := format('public.%I', table_name);
    readable_name := replace(table_name, '_', ' ');

    if to_regclass(qualified_table) is not null then
      execute format('alter table %s enable row level security', qualified_table);
      execute format('revoke all on %s from anon', qualified_table);
      execute format('grant select, insert, update, delete on %s to authenticated', qualified_table);
      execute format('drop policy if exists "BRQ homologation manage %s" on %s', table_name, qualified_table);
      execute format('drop policy if exists "Authenticated users read %s" on %s', table_name, qualified_table);
      execute format('drop policy if exists "Authenticated users manage %s" on %s', table_name, qualified_table);
      execute format('drop policy if exists "Authenticated users read %s" on %s', readable_name, qualified_table);
      execute format('drop policy if exists "Authenticated users manage %s" on %s', readable_name, qualified_table);
      execute format('drop policy if exists "Active BRQ users read %s" on %s', table_name, qualified_table);
      execute format('drop policy if exists "Editors manage %s" on %s', table_name, qualified_table);
      execute format('drop policy if exists "Active BRQ users read %s" on %s', readable_name, qualified_table);
      execute format('drop policy if exists "Editors manage %s" on %s', readable_name, qualified_table);
      execute format(
        'create policy "Active BRQ users read %s" on %s for select to authenticated using (public.is_active_brq_user())',
        table_name,
        qualified_table
      );
      execute format(
        'create policy "Editors manage %s" on %s for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data())',
        table_name,
        qualified_table
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.audit_log') is not null then
    alter table public.audit_log enable row level security;
    revoke all on public.audit_log from anon;
    grant select on public.audit_log to authenticated;
    drop policy if exists "Authenticated users read audit" on public.audit_log;
    drop policy if exists "Admins read audit" on public.audit_log;
    create policy "Admins read audit" on public.audit_log
    for select to authenticated
    using (public.is_delivery_admin());
  end if;
end $$;

grant execute on function public.is_brq_email(text) to anon, authenticated;
grant execute on function public.current_auth_email() to authenticated;
grant execute on function public.is_authenticated_brq_email() to authenticated;
grant execute on function public.is_active_brq_user() to authenticated;
grant execute on function public.can_edit_delivery_data() to authenticated;
grant execute on function public.is_delivery_admin() to authenticated;
grant execute on function public.accept_current_app_access() to authenticated;
grant execute on function public.list_app_access() to authenticated;
grant execute on function public.upsert_app_access(text, text, boolean) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_access_invites'
      and policyname = 'Admins manage access invites'
  ) then
    raise exception 'Access hardening failed: app_access_invites admin policy is missing';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and policyname like 'BRQ homologation manage %'
  ) then
    raise exception 'Access hardening failed: permissive homologation policies are still present';
  end if;
end $$;
