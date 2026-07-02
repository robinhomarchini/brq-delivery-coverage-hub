-- Require explicit admin approval after the first user login.
--
-- Flow:
-- 1. Admin pre-registers an @brq.com email in app_access_invites.
-- 2. The user requests the magic link and authenticates.
-- 3. The database creates/keeps app_users.active = false.
-- 4. Admin approves by setting app_users.active = true through upsert_app_access.

create or replace function public.count_other_active_delivery_admins(p_email text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.app_users u
  where lower(u.email) <> lower(trim(coalesce(p_email, '')))
    and u.role = 'admin'
    and u.active
    and public.is_brq_email(u.email);
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
  existing_user record;
  next_role text := 'viewer';
  next_active boolean := false;
begin
  select u.role, u.active
    into existing_user
    from public.app_users u
    where u.user_id = new.id
    limit 1;

  if normalized_email = 'robinson.marchini@brq.com' then
    next_role := 'admin';
    next_active := true;
  elsif public.is_brq_email(normalized_email) then
    select invite.role, invite.active
      into invite_record
      from public.app_access_invites invite
      where invite.email = normalized_email
      limit 1;

    if found then
      next_role := invite_record.role;
      next_active := coalesce(existing_user.active, false);
    end if;
  end if;

  insert into public.app_users(user_id, email, role, active)
  values (new.id, normalized_email, next_role, next_active)
  on conflict on constraint app_users_pkey do update
  set email = excluded.email,
      role = case
        when excluded.email = 'robinson.marchini@brq.com' then 'admin'
        when public.app_users.email = 'robinson.marchini@brq.com' then 'admin'
        else excluded.role
      end,
      active = case
        when excluded.email = 'robinson.marchini@brq.com' then true
        else public.app_users.active
      end,
      updated_at = now();

  if public.is_brq_email(normalized_email) then
    update public.app_access_invites invite
    set accepted_at = coalesce(invite.accepted_at, now()),
        updated_at = now()
    where invite.email = normalized_email;
  end if;

  return new;
end;
$$;

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
  invite_record record;
  existing_user record;
  next_role text := 'viewer';
  next_active boolean := false;
begin
  if current_user_id is null then
    return;
  end if;

  select u.role, u.active
    into existing_user
    from public.app_users u
    where u.user_id = current_user_id
    limit 1;

  if normalized_email = 'robinson.marchini@brq.com' then
    next_role := 'admin';
    next_active := true;
  elsif public.is_brq_email(normalized_email) then
    select invite.role, invite.active
      into invite_record
      from public.app_access_invites invite
      where invite.email = normalized_email
      limit 1;

    if found then
      next_role := invite_record.role;
      next_active := coalesce(existing_user.active, false);
    end if;
  end if;

  if not public.is_brq_email(normalized_email) then
    next_role := 'viewer';
    next_active := false;
  end if;

  insert into public.app_users(user_id, email, role, active)
  values (current_user_id, normalized_email, next_role, next_active)
  on conflict on constraint app_users_pkey do update
  set email = excluded.email,
      role = case
        when excluded.email = 'robinson.marchini@brq.com' then 'admin'
        else excluded.role
      end,
      active = case
        when excluded.email = 'robinson.marchini@brq.com' then true
        else public.app_users.active
      end,
      updated_at = now();

  if public.is_brq_email(normalized_email) then
    update public.app_access_invites invite
    set accepted_at = coalesce(invite.accepted_at, now()),
        updated_at = now()
    where invite.email = normalized_email;
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
      case
        when u.active then 'active'::text
        when i.email is not null and i.active then 'approval_pending'::text
        else 'blocked'::text
      end as status,
      u.created_at,
      u.updated_at
    from public.app_users u
    left join public.app_access_invites i on lower(i.email) = lower(u.email)
    where public.is_brq_email(u.email)

    union all

    select
      null::uuid as user_id,
      i.email,
      i.role,
      i.active,
      case when i.active then 'invited'::text else 'blocked'::text end as status,
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

grant execute on function public.count_other_active_delivery_admins(text) to authenticated;
grant execute on function public.accept_current_app_access() to authenticated;
grant execute on function public.list_app_access() to authenticated;
