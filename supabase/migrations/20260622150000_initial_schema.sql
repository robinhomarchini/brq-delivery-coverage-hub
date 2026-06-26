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
  director_owner_id text not null references public.people(id) on delete restrict,
  manager_owner_id text references public.people(id) on delete set null,
  area_id text not null references public.areas(id) on delete restrict,
  status text not null
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

alter table public.areas enable row level security;
alter table public.people enable row level security;
alter table public.territories enable row level security;
alter table public.customers enable row level security;

revoke all on public.areas, public.people, public.territories, public.customers from anon;
