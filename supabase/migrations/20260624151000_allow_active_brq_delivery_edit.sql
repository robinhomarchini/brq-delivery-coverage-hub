create or replace function public.can_edit_delivery_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_brq_user();
$$;

insert into public.app_users (user_id, email, role, active)
select
  id,
  lower(coalesce(email, '')),
  case
    when lower(coalesce(email, '')) in ('robinson.marchini@brq.com', 'rmarchini@brq.com') then 'admin'
    else 'editor'
  end,
  lower(coalesce(email, '')) like '%@brq.com'
from auth.users
where lower(coalesce(email, '')) like '%@brq.com'
on conflict (user_id) do update
set email = excluded.email,
    role = case
      when public.app_users.role = 'admin' then 'admin'
      else excluded.role
    end,
    active = excluded.active,
    updated_at = now();
