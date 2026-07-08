-- Release acoelho@brq.com after first-access password creation.
--
-- This keeps the general access rule intact: corporate users enter only when
-- their email has an active pre-registration or an active app_users row.

insert into public.app_access_invites(email, role, active, invited_by)
values ('acoelho@brq.com', 'viewer', true, null)
on conflict (email) do update
set active = true,
    role = case
      when public.app_access_invites.role in ('viewer', 'editor', 'admin') then public.app_access_invites.role
      else excluded.role
    end,
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
    role = case
      when public.app_users.role in ('admin', 'editor', 'viewer') then public.app_users.role
      else excluded.role
    end,
    active = true,
    updated_at = now();

update public.app_access_invites as invite
set accepted_at = coalesce(invite.accepted_at, now()),
    updated_at = now()
where invite.email = 'acoelho@brq.com'
  and exists (
    select 1
    from auth.users as auth_user
    where lower(trim(auth_user.email)) = 'acoelho@brq.com'
  );
