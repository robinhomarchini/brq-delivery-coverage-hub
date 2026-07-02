-- Restore owner admin aliases after adding final access approval.
--
-- Older migrations intentionally treated both corporate aliases below as owner
-- admins. The approval migration must preserve that invariant; otherwise the
-- active signed-in owner can be downgraded and lose edit permissions.

create or replace function public.is_initial_delivery_admin_email(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(trim(coalesce(p_email, ''))) in (
    'robinson.marchini@brq.com',
    'rmarchini@brq.com'
  );
$$;

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

  if public.is_initial_delivery_admin_email(normalized_email) then
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
        when public.is_initial_delivery_admin_email(excluded.email) then 'admin'
        when public.is_initial_delivery_admin_email(public.app_users.email) then 'admin'
        else excluded.role
      end,
      active = case
        when public.is_initial_delivery_admin_email(excluded.email) then true
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

  if public.is_initial_delivery_admin_email(normalized_email) then
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
        when public.is_initial_delivery_admin_email(excluded.email) then 'admin'
        else excluded.role
      end,
      active = case
        when public.is_initial_delivery_admin_email(excluded.email) then true
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

insert into public.app_access_invites(email, role, active)
values
  ('robinson.marchini@brq.com', 'admin', true),
  ('rmarchini@brq.com', 'admin', true)
on conflict on constraint app_access_invites_pkey do update
set role = 'admin',
    active = true,
    updated_at = now();

update public.app_users u
set role = 'admin',
    active = true,
    updated_at = now()
where public.is_initial_delivery_admin_email(u.email);

grant execute on function public.is_initial_delivery_admin_email(text) to authenticated;
grant execute on function public.count_other_active_delivery_admins(text) to authenticated;
grant execute on function public.handle_new_app_user() to authenticated;
grant execute on function public.accept_current_app_access() to authenticated;
