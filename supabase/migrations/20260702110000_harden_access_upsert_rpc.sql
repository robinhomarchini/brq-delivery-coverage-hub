-- Harden app access administration RPCs against PL/pgSQL output-column ambiguity.
--
-- PostgreSQL exposes RETURNS TABLE columns as PL/pgSQL variables. A function
-- with an output column named "email" can therefore fail with
-- "column reference email is ambiguous" if any statement leaves column
-- resolution to inference. Keep all operational variables prefixed and all
-- table references explicitly aliased.

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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_active boolean := coalesce(p_active, false);
  v_existing_is_admin boolean := false;
begin
  if not public.is_delivery_admin() then
    raise exception 'Apenas administradores podem gerenciar acessos.'
      using errcode = '42501';
  end if;

  if not public.is_brq_email(v_email) then
    raise exception 'Informe um e-mail corporativo @brq.com.'
      using errcode = '22023';
  end if;

  if v_role not in ('viewer', 'editor', 'admin') then
    raise exception 'Papel de acesso inválido: %', p_role
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.list_app_access() as access_row
    where lower(access_row.email) = v_email
      and access_row.role = 'admin'
      and access_row.active
  ) into v_existing_is_admin;

  if v_existing_is_admin
     and (v_role <> 'admin' or not v_active)
     and public.count_other_active_delivery_admins(v_email) < 1 then
    raise exception 'Mantenha ao menos um administrador ativo.'
      using errcode = '22023';
  end if;

  insert into public.app_access_invites as invite (email, role, active, invited_by)
  values (v_email, v_role, v_active, auth.uid())
  on conflict on constraint app_access_invites_pkey do update
  set role = excluded.role,
      active = excluded.active,
      invited_by = auth.uid(),
      updated_at = now();

  update public.app_users as app_user
  set role = v_role,
      active = v_active,
      updated_at = now()
  where lower(app_user.email) = v_email;

  return query
  select
    access_row.user_id,
    access_row.email,
    access_row.role,
    access_row.active,
    access_row.status,
    access_row.created_at,
    access_row.updated_at
  from public.list_app_access() as access_row
  where lower(access_row.email) = v_email;
end;
$$;

grant execute on function public.upsert_app_access(text, text, boolean) to authenticated;
