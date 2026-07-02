-- Preserve approved corporate access across Supabase auth user-id changes.
--
-- The application access model stores app_users by auth.user_id, while admins
-- approve people by corporate email. If Supabase creates or uses a different
-- auth user id for an already-approved email, the previous implementation could
-- create/keep the current session row inactive even though the email was
-- already approved. Login acceptance must preserve approved access by email.

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
  existing_email_user record;
  next_role text := 'viewer';
  next_active boolean := false;
begin
  select app_user.role, app_user.active
    into existing_user
    from public.app_users as app_user
    where app_user.user_id = new.id
    limit 1;

  select app_user.role, app_user.active
    into existing_email_user
    from public.app_users as app_user
    where lower(app_user.email) = normalized_email
      and app_user.active
    order by app_user.updated_at desc nulls last
    limit 1;

  if public.is_initial_delivery_admin_email(normalized_email) then
    next_role := 'admin';
    next_active := true;
  elsif public.is_brq_email(normalized_email) then
    select invite.role, invite.active
      into invite_record
      from public.app_access_invites as invite
      where invite.email = normalized_email
      limit 1;

    if found then
      next_role := coalesce(existing_email_user.role, invite_record.role);
      next_active := coalesce(existing_user.active, false) or coalesce(existing_email_user.active, false);
    elsif existing_email_user.active then
      next_role := existing_email_user.role;
      next_active := true;
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
        else excluded.active
      end,
      updated_at = now();

  if public.is_brq_email(normalized_email) then
    update public.app_access_invites as invite
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
  existing_email_user record;
  next_role text := 'viewer';
  next_active boolean := false;
begin
  if current_user_id is null then
    return;
  end if;

  select app_user.role, app_user.active
    into existing_user
    from public.app_users as app_user
    where app_user.user_id = current_user_id
    limit 1;

  select app_user.role, app_user.active
    into existing_email_user
    from public.app_users as app_user
    where lower(app_user.email) = normalized_email
      and app_user.active
    order by app_user.updated_at desc nulls last
    limit 1;

  if public.is_initial_delivery_admin_email(normalized_email) then
    next_role := 'admin';
    next_active := true;
  elsif public.is_brq_email(normalized_email) then
    select invite.role, invite.active
      into invite_record
      from public.app_access_invites as invite
      where invite.email = normalized_email
      limit 1;

    if found then
      next_role := coalesce(existing_email_user.role, invite_record.role);
      next_active := coalesce(existing_user.active, false) or coalesce(existing_email_user.active, false);
    elsif existing_email_user.active then
      next_role := existing_email_user.role;
      next_active := true;
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
        else excluded.active
      end,
      updated_at = now();

  if public.is_brq_email(normalized_email) then
    update public.app_access_invites as invite
    set accepted_at = coalesce(invite.accepted_at, now()),
        updated_at = now()
    where invite.email = normalized_email;
  end if;

  return query
  select app_user.user_id, app_user.email, app_user.role, app_user.active, app_user.created_at, app_user.updated_at
  from public.app_users as app_user
  where app_user.user_id = current_user_id;
end;
$$;

grant execute on function public.handle_new_app_user() to authenticated;
grant execute on function public.accept_current_app_access() to authenticated;
