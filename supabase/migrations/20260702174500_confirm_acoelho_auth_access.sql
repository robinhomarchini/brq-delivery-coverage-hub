-- Confirm acoelho@brq.com in Supabase Auth and keep the app access active.
--
-- First-access password creation can leave the Auth user waiting for email
-- confirmation depending on the Supabase Auth project setting. The app access
-- is already released; this migration removes that Auth-side blocker for this
-- specific corporate user.

update auth.users as auth_user
set email_confirmed_at = coalesce(auth_user.email_confirmed_at, now()),
    updated_at = now()
where lower(trim(auth_user.email)) = 'acoelho@brq.com';

insert into public.app_access_invites(email, role, active, invited_by)
values ('acoelho@brq.com', 'viewer', true, null)
on conflict (email) do update
set active = true,
    updated_at = now();

insert into public.app_users(user_id, email, role, active)
select
  auth_user.id,
  lower(trim(auth_user.email)),
  coalesce(invite.role, 'viewer'),
  true
from auth.users as auth_user
left join public.app_access_invites as invite
  on invite.email = lower(trim(auth_user.email))
where lower(trim(auth_user.email)) = 'acoelho@brq.com'
on conflict on constraint app_users_pkey do update
set email = excluded.email,
    active = true,
    updated_at = now();
