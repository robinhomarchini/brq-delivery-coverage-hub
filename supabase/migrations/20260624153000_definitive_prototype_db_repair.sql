-- Definitive prototype repair for BRQ Delivery Coverage Hub.
--
-- Goal:
-- - Align the remote Supabase database with the current application contract.
-- - Stop CRUD failures caused by partially-applied RBAC/RLS migrations.
-- - Keep anonymous users blocked.
-- - Allow every authenticated user to read and edit prototype data.
--
-- Production hardening note:
-- Replace the can_edit_delivery_data() implementation and policies with RBAC
-- before using this as a production/internal-governed system.

create table if not exists public.areas (
  id text primary key,
  name text not null,
  description text not null default ''
);

create table if not exists public.people (
  id text primary key,
  name text not null,
  email text not null,
  job_title text not null,
  director_id text references public.people(id) on delete set null,
  manager_id text references public.people(id) on delete set null,
  role_type text not null,
  area_id text references public.areas(id) on delete set null,
  territory_ids text[] not null default '{}',
  client_ids text[] not null default '{}',
  photo_url text,
  notes text,
  active boolean not null default true,
  is_manager boolean not null default false,
  hierarchy_level smallint not null check (hierarchy_level between 1 and 3)
);

create table if not exists public.territories (
  id text primary key,
  name text not null,
  director_owner_id text references public.people(id) on delete restrict,
  manager_owner_id text references public.people(id) on delete set null,
  area_id text references public.areas(id) on delete restrict,
  status text not null default 'Ativo'
);

create table if not exists public.customers (
  id text primary key,
  name text not null,
  industry text not null,
  director_responsible_id text not null references public.people(id) on delete restrict,
  manager_responsible_id text not null references public.people(id) on delete restrict,
  manager_responsible_ids text[] not null default '{}',
  territory_id text references public.territories(id) on delete set null,
  revenue numeric(14, 2) not null default 0,
  margin numeric(5, 2) not null default 0,
  strategic_account boolean not null default false
);

create table if not exists public.subjects (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  name text not null,
  description text not null default '',
  owner_person_id text references public.people(id) on delete set null,
  status text not null default 'Ativo',
  strategic boolean not null default false
);

create table if not exists public.portfolio_directors (
  id text primary key,
  name text not null,
  job_title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_delivery_managers (
  id text primary key,
  name text not null,
  director_id text not null references public.portfolio_directors(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_plans (
  id text primary key,
  customer_name text not null,
  customer_cluster text not null,
  industry text not null,
  director_id text not null references public.portfolio_directors(id) on delete restrict,
  manager_ids text[] not null default '{}',
  revenue_current numeric(14,2) not null default 0,
  revenue_target numeric(14,2) not null default 0,
  renewal_revenue numeric(14,2) not null default 0,
  expansion_revenue numeric(14,2) not null default 0,
  new_business_revenue numeric(14,2) not null default 0,
  hunter_revenue numeric(14,2) not null default 0,
  delivery_farmer_revenue numeric(14,2) not null default 0,
  source_customer_names text[] not null default '{}',
  source_file text not null default 'Curva de Vendas Revisada (1).xlsx',
  imported_at date not null default date '2026-06-24',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('viewer', 'editor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

alter table public.customers add column if not exists manager_responsible_ids text[] not null default '{}';
alter table public.customers alter column territory_id drop not null;
alter table public.territories alter column director_owner_id drop not null;
alter table public.territories alter column area_id drop not null;
alter table public.subjects add column if not exists description text not null default '';
alter table public.subjects add column if not exists owner_person_id text references public.people(id) on delete set null;
alter table public.subjects add column if not exists strategic boolean not null default false;
alter table public.portfolio_directors add column if not exists created_at timestamptz not null default now();
alter table public.portfolio_directors add column if not exists updated_at timestamptz not null default now();
alter table public.portfolio_delivery_managers add column if not exists created_at timestamptz not null default now();
alter table public.portfolio_delivery_managers add column if not exists updated_at timestamptz not null default now();
alter table public.revenue_plans add column if not exists hunter_revenue numeric(14,2) not null default 0;
alter table public.revenue_plans add column if not exists delivery_farmer_revenue numeric(14,2) not null default 0;

alter table public.areas add column if not exists created_at timestamptz not null default now();
alter table public.areas add column if not exists updated_at timestamptz not null default now();
alter table public.people add column if not exists created_at timestamptz not null default now();
alter table public.people add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.subjects add column if not exists created_at timestamptz not null default now();
alter table public.subjects add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'people_role_type_check') then
    alter table public.people add constraint people_role_type_check
      check (role_type in ('Executive', 'Director', 'Farmer + Delivery', 'Delivery', 'Staff'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'people_email_length_check') then
    alter table public.people add constraint people_email_length_check
      check (char_length(email) between 3 and 254);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customers_revenue_check') then
    alter table public.customers add constraint customers_revenue_check check (revenue >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'customers_margin_check') then
    alter table public.customers add constraint customers_margin_check check (margin between 0 and 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subjects_status_check') then
    alter table public.subjects add constraint subjects_status_check
      check (status in ('Ativo', 'Em evolução', 'Atenção', 'Planejado'));
  end if;
end $$;

create unique index if not exists people_email_unique on public.people(lower(email));
create index if not exists customers_manager_responsible_ids_idx on public.customers using gin(manager_responsible_ids);
create unique index if not exists subjects_customer_name_unique on public.subjects(customer_id, lower(name));
create index if not exists subjects_customer_id_idx on public.subjects(customer_id);
create index if not exists subjects_owner_person_id_idx on public.subjects(owner_person_id);
create index if not exists revenue_plans_director_id_idx on public.revenue_plans(director_id);
create index if not exists revenue_plans_manager_ids_idx on public.revenue_plans using gin(manager_ids);
create index if not exists revenue_plans_customer_cluster_idx on public.revenue_plans(customer_cluster);

create or replace function public.is_authenticated_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.is_active_brq_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.can_edit_delivery_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.is_delivery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.handle_new_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users(user_id, email, role, active)
  values (new.id, lower(coalesce(new.email, '')), 'editor', true)
  on conflict (user_id) do update
  set email = excluded.email,
      role = case when public.app_users.role = 'admin' then 'admin' else 'editor' end,
      active = true,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_app_user();

insert into public.app_users(user_id, email, role, active)
select
  id,
  lower(coalesce(email, '')),
  case
    when lower(coalesce(email, '')) in ('robinson.marchini@brq.com', 'rmarchini@brq.com') then 'admin'
    else 'editor'
  end,
  true
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    role = case when public.app_users.role = 'admin' then 'admin' else excluded.role end,
    active = true,
    updated_at = now();

create or replace function public.audit_delivery_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  actor_id uuid;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  actor_id := case
    when exists (select 1 from auth.users where id = auth.uid()) then auth.uid()
    else null
  end;
  insert into public.audit_log(table_name, record_id, operation, old_data, new_data, changed_by)
  values (tg_table_name, coalesce(new_row ->> 'id', old_row ->> 'id'), tg_op, old_row, new_row, actor_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['areas', 'people', 'customers', 'subjects', 'portfolio_directors', 'portfolio_delivery_managers', 'revenue_plans']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;

  foreach table_name in array array['areas', 'people', 'customers', 'subjects']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_delivery_change()', table_name, table_name);
  end loop;
end $$;

alter table public.app_users enable row level security;
alter table public.areas enable row level security;
alter table public.people enable row level security;
alter table public.territories enable row level security;
alter table public.customers enable row level security;
alter table public.subjects enable row level security;
alter table public.portfolio_directors enable row level security;
alter table public.portfolio_delivery_managers enable row level security;
alter table public.revenue_plans enable row level security;
alter table public.audit_log enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['areas', 'people', 'territories', 'customers', 'subjects', 'portfolio_directors', 'portfolio_delivery_managers', 'revenue_plans', 'app_users', 'audit_log']
  loop
    execute format('drop policy if exists "Prototype full access %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "BRQ access %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Active BRQ users read %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Editors manage %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Authenticated users read %s" on public.%I', table_name, table_name);
    execute format('drop policy if exists "Authenticated users manage %s" on public.%I', table_name, table_name);
  end loop;
end $$;

drop policy if exists "Users read own access" on public.app_users;
drop policy if exists "Admins manage access" on public.app_users;
drop policy if exists "Admins read audit" on public.audit_log;
drop policy if exists "Active BRQ users read portfolio directors" on public.portfolio_directors;
drop policy if exists "Editors manage portfolio directors" on public.portfolio_directors;
drop policy if exists "Active BRQ users read portfolio managers" on public.portfolio_delivery_managers;
drop policy if exists "Editors manage portfolio managers" on public.portfolio_delivery_managers;
drop policy if exists "Active BRQ users read revenue plans" on public.revenue_plans;
drop policy if exists "Editors manage revenue plans" on public.revenue_plans;
drop policy if exists "Authenticated users read own access" on public.app_users;
drop policy if exists "Authenticated users manage own access" on public.app_users;
drop policy if exists "Authenticated users read audit" on public.audit_log;

revoke all on public.areas, public.people, public.territories, public.customers, public.subjects, public.portfolio_directors, public.portfolio_delivery_managers, public.revenue_plans, public.app_users, public.audit_log from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.areas, public.people, public.territories, public.customers, public.subjects, public.portfolio_directors, public.portfolio_delivery_managers, public.revenue_plans to authenticated;
grant select, insert, update on public.app_users to authenticated;
grant select on public.audit_log to authenticated;

create policy "Authenticated users read areas" on public.areas for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage areas" on public.areas for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read people" on public.people for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage people" on public.people for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read territories" on public.territories for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage territories" on public.territories for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read customers" on public.customers for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage customers" on public.customers for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read subjects" on public.subjects for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage subjects" on public.subjects for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read portfolio_directors" on public.portfolio_directors for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage portfolio_directors" on public.portfolio_directors for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read portfolio_delivery_managers" on public.portfolio_delivery_managers for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage portfolio_delivery_managers" on public.portfolio_delivery_managers for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read revenue_plans" on public.revenue_plans for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage revenue_plans" on public.revenue_plans for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read own access" on public.app_users for select to authenticated using (auth.uid() is not null);
create policy "Authenticated users manage own access" on public.app_users for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated users read audit" on public.audit_log for select to authenticated using (auth.uid() is not null);

update public.customers
set manager_responsible_ids = array[manager_responsible_id]
where coalesce(array_length(manager_responsible_ids, 1), 0) = 0
  and manager_responsible_id is not null
  and manager_responsible_id <> '';

insert into public.portfolio_directors(id, name, job_title) values
  ('ca', 'CA', 'Diretor de Delivery'),
  ('ane', 'Ane Knust', 'Diretora de Delivery')
on conflict (id) do update set name = excluded.name, job_title = excluded.job_title;

insert into public.portfolio_delivery_managers(id, name, director_id) values
  ('bruno', 'Bruno', 'ca'),
  ('orion', 'Orion', 'ca'),
  ('fernanda', 'Fernanda', 'ca'),
  ('bonfim', 'Ricardo Bonfim', 'ca'),
  ('ana', 'Ana Braz', 'ane')
on conflict (id) do update set name = excluded.name, director_id = excluded.director_id;

-- Final smoke-test assertions. These raise a clear SQL error if the database
-- contract still does not match the application.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'client_ids'
  ) then
    raise exception 'Repair failed: public.people.client_ids is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'manager_responsible_ids'
  ) then
    raise exception 'Repair failed: public.customers.manager_responsible_ids is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'people'
      and policyname = 'Authenticated users manage people'
  ) then
    raise exception 'Repair failed: public.people write RLS policy is missing';
  end if;
end $$;
