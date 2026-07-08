-- Auto-activate users that already have an active corporate pre-registration.
--
-- Access policy:
-- - app_access_invites.active = true means the administrator has already
--   released the email for first access;
-- - the first login creates/updates app_users.active = true;
-- - inactive invites and unknown emails remain blocked.

create or replace function public.handle_new_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_invite record;
  v_existing_user record;
  v_existing_active_email_user record;
  v_role text := 'viewer';
  v_active boolean := false;
begin
  select app_user.role, app_user.active
    into v_existing_user
    from public.app_users as app_user
    where app_user.user_id = new.id
    limit 1;

  select app_user.role, app_user.active
    into v_existing_active_email_user
    from public.app_users as app_user
    where lower(app_user.email) = v_email
      and app_user.active
    order by app_user.updated_at desc nulls last
    limit 1;

  if public.is_initial_delivery_admin_email(v_email) then
    v_role := 'admin';
    v_active := true;
  elsif public.is_brq_email(v_email) then
    select invite.role, invite.active
      into v_invite
      from public.app_access_invites as invite
      where invite.email = v_email
      limit 1;

    if found then
      v_role := coalesce(v_existing_active_email_user.role, v_invite.role);
      v_active := coalesce(v_existing_user.active, false)
        or coalesce(v_existing_active_email_user.active, false)
        or coalesce(v_invite.active, false);
    elsif coalesce(v_existing_active_email_user.active, false) then
      v_role := v_existing_active_email_user.role;
      v_active := true;
    end if;
  end if;

  insert into public.app_users(user_id, email, role, active)
  values (new.id, v_email, v_role, v_active)
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

  if public.is_brq_email(v_email) then
    update public.app_access_invites as invite
    set accepted_at = case
          when v_active then coalesce(invite.accepted_at, now())
          else invite.accepted_at
        end,
        updated_at = now()
    where invite.email = v_email;
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
  v_user_id uuid := auth.uid();
  v_email text := public.current_auth_email();
  v_invite record;
  v_existing_user record;
  v_existing_active_email_user record;
  v_role text := 'viewer';
  v_active boolean := false;
begin
  if v_user_id is null then
    return;
  end if;

  select app_user.role, app_user.active
    into v_existing_user
    from public.app_users as app_user
    where app_user.user_id = v_user_id
    limit 1;

  select app_user.role, app_user.active
    into v_existing_active_email_user
    from public.app_users as app_user
    where lower(app_user.email) = v_email
      and app_user.active
    order by app_user.updated_at desc nulls last
    limit 1;

  if public.is_initial_delivery_admin_email(v_email) then
    v_role := 'admin';
    v_active := true;
  elsif public.is_brq_email(v_email) then
    select invite.role, invite.active
      into v_invite
      from public.app_access_invites as invite
      where invite.email = v_email
      limit 1;

    if found then
      v_role := coalesce(v_existing_active_email_user.role, v_invite.role);
      v_active := coalesce(v_existing_user.active, false)
        or coalesce(v_existing_active_email_user.active, false)
        or coalesce(v_invite.active, false);
    elsif coalesce(v_existing_active_email_user.active, false) then
      v_role := v_existing_active_email_user.role;
      v_active := true;
    end if;
  end if;

  if not public.is_brq_email(v_email) then
    v_role := 'viewer';
    v_active := false;
  end if;

  insert into public.app_users(user_id, email, role, active)
  values (v_user_id, v_email, v_role, v_active)
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

  if public.is_brq_email(v_email) then
    update public.app_access_invites as invite
    set accepted_at = case
          when v_active then coalesce(invite.accepted_at, now())
          else invite.accepted_at
        end,
        updated_at = now()
    where invite.email = v_email;
  end if;

  return query
  select app_user.user_id, app_user.email, app_user.role, app_user.active, app_user.created_at, app_user.updated_at
  from public.app_users as app_user
  where app_user.user_id = v_user_id;
end;
$$;

update public.app_users as app_user
set role = case
      when public.is_initial_delivery_admin_email(app_user.email) then 'admin'
      else invite.role
    end,
    active = true,
    updated_at = now()
from public.app_access_invites as invite
where lower(invite.email) = lower(app_user.email)
  and invite.active
  and public.is_brq_email(app_user.email);

update public.app_users as app_user
set role = 'admin',
    active = true,
    updated_at = now()
where public.is_initial_delivery_admin_email(app_user.email);

grant execute on function public.handle_new_app_user() to authenticated;
grant execute on function public.accept_current_app_access() to authenticated;
