-- Fix access administration RPC ambiguity when pre-registering users.
--
-- In PL/pgSQL functions that return a table with an "email" column, PostgreSQL
-- also exposes "email" as an output variable. Using `on conflict (email)` can
-- therefore be interpreted ambiguously. Use the table primary-key constraint
-- explicitly and keep all returned/filter columns qualified.

create or replace function public.upsert_app_access(
  p_email text,
  p_role text,
  p_active boolean default true
)
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
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_role text := lower(trim(coalesce(p_role, '')));
  existing_is_admin boolean := false;
begin
  if not public.is_delivery_admin() then
    raise exception 'Apenas administradores podem gerenciar acessos.'
      using errcode = '42501';
  end if;

  if not public.is_brq_email(normalized_email) then
    raise exception 'Informe um e-mail corporativo @brq.com.'
      using errcode = '22023';
  end if;

  if normalized_role not in ('viewer', 'editor', 'admin') then
    raise exception 'Papel de acesso inválido: %', p_role
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.list_app_access() access_row
    where lower(access_row.email) = normalized_email
      and access_row.role = 'admin'
      and access_row.active
  ) into existing_is_admin;

  if existing_is_admin
     and (normalized_role <> 'admin' or not p_active)
     and public.count_other_active_delivery_admins(normalized_email) < 1 then
    raise exception 'Mantenha ao menos um administrador ativo.'
      using errcode = '22023';
  end if;

  insert into public.app_access_invites(email, role, active, invited_by)
  values (normalized_email, normalized_role, p_active, auth.uid())
  on conflict on constraint app_access_invites_pkey do update
  set role = excluded.role,
      active = excluded.active,
      invited_by = auth.uid(),
      updated_at = now();

  update public.app_users u
  set role = normalized_role,
      active = p_active,
      updated_at = now()
  where lower(u.email) = normalized_email;

  return query
  select
    access_row.user_id,
    access_row.email,
    access_row.role,
    access_row.active,
    access_row.status,
    access_row.created_at,
    access_row.updated_at
  from public.list_app_access() access_row
  where lower(access_row.email) = normalized_email;
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
  next_role text;
  next_active boolean;
begin
  if current_user_id is null then
    return;
  end if;

  if not public.is_brq_email(normalized_email) then
    insert into public.app_users(user_id, email, role, active)
    values (current_user_id, normalized_email, 'viewer', false)
    on conflict on constraint app_users_pkey do update
    set email = excluded.email,
        active = false,
        updated_at = now();
    return;
  end if;

  select invite.role, invite.active
    into next_role, next_active
    from public.app_access_invites invite
    where invite.email = normalized_email
    limit 1;

  if normalized_email = 'robinson.marchini@brq.com' then
    next_role := 'admin';
    next_active := true;
  end if;

  if next_role is not null then
    insert into public.app_users(user_id, email, role, active)
    values (current_user_id, normalized_email, next_role, next_active)
    on conflict on constraint app_users_pkey do update
    set email = excluded.email,
        role = case when excluded.email = 'robinson.marchini@brq.com' then 'admin' else excluded.role end,
        active = case when excluded.email = 'robinson.marchini@brq.com' then true else excluded.active end,
        updated_at = now();

    if next_active then
      update public.app_access_invites invite
      set accepted_at = coalesce(invite.accepted_at, now()),
          updated_at = now()
      where invite.email = normalized_email;
    end if;
  elsif not exists (select 1 from public.app_users app_user where app_user.user_id = current_user_id) then
    insert into public.app_users(user_id, email, role, active)
    values (current_user_id, normalized_email, 'viewer', false);
  else
    update public.app_users app_user
    set email = normalized_email,
        active = case when public.is_brq_email(normalized_email) then app_user.active else false end,
        updated_at = now()
    where app_user.user_id = current_user_id;
  end if;

  return query
  select app_user.user_id, app_user.email, app_user.role, app_user.active, app_user.created_at, app_user.updated_at
  from public.app_users app_user
  where app_user.user_id = current_user_id;
end;
$$;

grant execute on function public.upsert_app_access(text, text, boolean) to authenticated;
grant execute on function public.accept_current_app_access() to authenticated;
