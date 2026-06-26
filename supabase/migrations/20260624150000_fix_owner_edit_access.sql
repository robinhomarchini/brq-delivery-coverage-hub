create or replace function public.delivery_default_role(email text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(email, '')) in ('robinson.marchini@brq.com', 'rmarchini@brq.com') then 'admin'
    else 'viewer'
  end;
$$;

create or replace function public.handle_new_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (user_id, email, role, active)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    public.delivery_default_role(new.email),
    lower(coalesce(new.email, '')) like '%@brq.com'
  )
  on conflict (user_id) do update
  set email = excluded.email,
      role = case
        when public.delivery_default_role(excluded.email) = 'admin' then 'admin'
        else public.app_users.role
      end,
      active = excluded.active,
      updated_at = now();
  return new;
end;
$$;

insert into public.app_users (user_id, email, role, active)
select
  id,
  lower(coalesce(email, '')),
  public.delivery_default_role(email),
  lower(coalesce(email, '')) like '%@brq.com'
from auth.users
where lower(coalesce(email, '')) in ('robinson.marchini@brq.com', 'rmarchini@brq.com')
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin',
    active = true,
    updated_at = now();
