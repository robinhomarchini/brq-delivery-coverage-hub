-- Fix access-admin RPC ambiguity and add safe deletion.
--
-- The previous list_app_access() ordered by "email" inside a PL/pgSQL function
-- that also returns a column named email. PostgreSQL can treat that reference
-- as ambiguous. This migration uses explicit aliases and adds delete_app_access
-- with a last-active-admin guard.

create or replace function public.count_other_active_delivery_admins(p_email text)
returns integer
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select lower(trim(coalesce(p_email, ''))) as email
  ),
  access_rows as (
    select lower(u.email) as email, u.role, u.active
    from public.app_users u
    union all
    select lower(i.email) as email, i.role, i.active
    from public.app_access_invites i
    where not exists (
      select 1
      from public.app_users u
      where lower(u.email) = lower(i.email)
    )
  )
  select count(*)::integer
  from access_rows access_row
  cross join normalized
  where access_row.email <> normalized.email
    and access_row.role = 'admin'
    and access_row.active;
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
  select
    access_row.user_id,
    access_row.email,
    access_row.role,
    access_row.active,
    access_row.status,
    access_row.created_at,
    access_row.updated_at
  from (
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

    select
      null::uuid as user_id,
      i.email,
      i.role,
      i.active,
      'pending'::text as status,
      i.created_at,
      i.updated_at
    from public.app_access_invites i
    where public.is_brq_email(i.email)
      and not exists (
        select 1
        from public.app_users u
        where lower(u.email) = lower(i.email)
      )
  ) access_row
  order by access_row.email;
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
  existing_is_admin boolean := false;
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

  select exists (
    select 1
    from public.list_app_access() access_row
    where lower(access_row.email) = normalized_email
      and access_row.role = 'admin'
      and access_row.active
  ) into existing_is_admin;

  if existing_is_admin
     and (normalized_role <> 'admin' or not p_active)
     and public.count_other_active_delivery_admins(normalized_email) < 1 then
    raise exception 'Mantenha ao menos um administrador ativo.'
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
  where lower(u.email) = normalized_email;

  return query
  select access_row.*
  from public.list_app_access() access_row
  where lower(access_row.email) = normalized_email;
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

grant execute on function public.count_other_active_delivery_admins(text) to authenticated;
grant execute on function public.list_app_access() to authenticated;
grant execute on function public.upsert_app_access(text, text, boolean) to authenticated;
grant execute on function public.delete_app_access(text) to authenticated;

-- Smoke query: if this runs, list_app_access no longer has ambiguous email
-- references. It only returns rows for an admin session.
select proname
from pg_proc
where proname in ('list_app_access', 'upsert_app_access', 'delete_app_access');
