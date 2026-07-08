-- Recover app access rows when the session JWT does not expose an email claim.
--
-- Some auth sessions can reach accept_current_app_access() without
-- auth.jwt()->>'email'. The previous function could then keep or overwrite
-- app_users.email with an empty value, making the user invisible to the admin
-- access list. Use auth.users.email as the canonical fallback and backfill
-- existing rows by auth user id.

create or replace function public.current_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    (
      select auth_user.email
      from auth.users as auth_user
      where auth_user.id = auth.uid()
      limit 1
    ),
    ''
  )));
$$;

update public.app_users as app_user
set email = lower(trim(auth_user.email)),
    updated_at = now()
from auth.users as auth_user
where app_user.user_id = auth_user.id
  and public.is_brq_email(auth_user.email)
  and not public.is_brq_email(app_user.email);

insert into public.app_users(user_id, email, role, active)
select
  auth_user.id,
  lower(trim(auth_user.email)),
  case
    when public.is_initial_delivery_admin_email(auth_user.email) then 'admin'
    else coalesce(invite.role, 'viewer')
  end,
  public.is_initial_delivery_admin_email(auth_user.email)
    or coalesce(invite.active, false)
from auth.users as auth_user
left join public.app_access_invites as invite
  on invite.email = lower(trim(auth_user.email))
where public.is_brq_email(auth_user.email)
on conflict on constraint app_users_pkey do update
set email = excluded.email,
    role = case
      when public.is_initial_delivery_admin_email(excluded.email) then 'admin'
      when public.app_users.active then public.app_users.role
      else excluded.role
    end,
    active = case
      when public.is_initial_delivery_admin_email(excluded.email) then true
      else public.app_users.active or excluded.active
    end,
    updated_at = now();

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

grant execute on function public.current_auth_email() to authenticated;
