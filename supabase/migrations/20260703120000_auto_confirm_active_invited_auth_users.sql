-- Smooth first access for admin-approved corporate users.
--
-- Supabase Auth can require email confirmation after signUp. For this internal
-- hub, app access is already controlled by admin-managed active invites in
-- app_access_invites. A pre-registered active @brq.com user should be able to
-- create a password and then log in without a second manual admin/database step.
-- Unknown or inactive emails remain unconfirmed/blocked by the existing access
-- checks.

create or replace function public.auto_confirm_active_invited_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
begin
  if public.is_initial_delivery_admin_email(v_email)
    or (
      public.is_brq_email(v_email)
      and exists (
        select 1
        from public.app_access_invites as invite
        where invite.email = v_email
          and invite.active
      )
    )
  then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists auto_confirm_active_invited_auth_user on auth.users;
create trigger auto_confirm_active_invited_auth_user
before insert or update of email on auth.users
for each row execute function public.auto_confirm_active_invited_auth_user();

update auth.users as auth_user
set email_confirmed_at = coalesce(auth_user.email_confirmed_at, now()),
    updated_at = now()
from public.app_access_invites as invite
where lower(trim(auth_user.email)) = invite.email
  and invite.active
  and public.is_brq_email(auth_user.email)
  and auth_user.email_confirmed_at is null;

update auth.users as auth_user
set email_confirmed_at = coalesce(auth_user.email_confirmed_at, now()),
    updated_at = now()
where public.is_initial_delivery_admin_email(auth_user.email)
  and auth_user.email_confirmed_at is null;
