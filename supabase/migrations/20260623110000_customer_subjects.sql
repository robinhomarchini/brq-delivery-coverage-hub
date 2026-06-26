create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
    case when lower(coalesce(new.email, '')) = 'robinson.marchini@brq.com' then 'admin' else 'viewer' end,
    lower(coalesce(new.email, '')) like '%@brq.com'
  )
  on conflict (user_id) do update
  set email = excluded.email,
      active = excluded.active,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_app_user();

insert into public.app_users (user_id, email, role, active)
select
  id,
  lower(coalesce(email, '')),
  case when lower(coalesce(email, '')) = 'robinson.marchini@brq.com' then 'admin' else 'viewer' end,
  lower(coalesce(email, '')) like '%@brq.com'
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    active = excluded.active,
    updated_at = now();

create or replace function public.is_active_brq_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) like '%@brq.com'
    and exists (
      select 1 from public.app_users
      where user_id = auth.uid() and active
    );
$$;

create or replace function public.can_edit_delivery_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_brq_user()
    and exists (
      select 1 from public.app_users
      where user_id = auth.uid() and active and role in ('editor', 'admin')
    );
$$;

create or replace function public.is_delivery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_brq_user()
    and exists (
      select 1 from public.app_users
      where user_id = auth.uid() and active and role = 'admin'
    );
$$;

alter table public.customers alter column territory_id drop not null;

create table if not exists public.subjects (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  name text not null,
  description text not null default '',
  owner_person_id text references public.people(id) on delete set null,
  status text not null check (status in ('Ativo', 'Em evolução', 'Atenção', 'Planejado')),
  strategic boolean not null default false
);

create unique index if not exists subjects_customer_name_unique
on public.subjects (customer_id, lower(name));
create index if not exists subjects_customer_id_idx on public.subjects(customer_id);
create index if not exists subjects_owner_person_id_idx on public.subjects(owner_person_id);
create unique index if not exists people_email_unique on public.people(lower(email));

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
end $$;

insert into public.subjects (id, customer_id, name, description, owner_person_id, status, strategic) values
('subject-itau-data', 'client-itau', 'Dados', 'Frente de atuação de Dados no cliente.', 'flavia', 'Ativo', true),
('subject-itau-checking', 'client-itau', 'Conta Corrente', 'Frente de atuação de Conta Corrente no cliente.', 'flavia', 'Ativo', true),
('subject-itau-investments', 'client-itau', 'Investimentos', 'Frente de atuação de Investimentos no cliente.', 'flavia', 'Em evolução', true),
('subject-itau-cards', 'client-itau', 'Cartões', 'Frente de atuação de Cartões no cliente.', 'flavia', 'Ativo', false),
('subject-stone-payments', 'client-stone', 'Pagamentos', 'Frente de atuação de Pagamentos no cliente.', 'flavia', 'Ativo', true),
('subject-stone-data', 'client-stone', 'Dados', 'Frente de atuação de Dados no cliente.', 'flavia', 'Em evolução', false),
('subject-porto-claims', 'client-porto', 'Sinistros', 'Frente de atuação de Sinistros no cliente.', 'ana', 'Ativo', true),
('subject-porto-digital', 'client-porto', 'Seguros Digitais', 'Frente de atuação de Seguros Digitais no cliente.', 'ana', 'Ativo', false),
('subject-tokio-policies', 'client-tokio', 'Apólices', 'Frente de atuação de Apólices no cliente.', 'ana', 'Planejado', false),
('subject-renner-commerce', 'client-renner', 'E-commerce', 'Frente de atuação de E-commerce no cliente.', 'everton', 'Ativo', true),
('subject-renner-loyalty', 'client-renner', 'Fidelidade', 'Frente de atuação de Fidelidade no cliente.', 'everton', 'Ativo', false),
('subject-natura-omnichannel', 'client-natura', 'Omnichannel', 'Frente de atuação de Omnichannel no cliente.', 'everton', 'Em evolução', false),
('subject-embraer-engineering', 'client-embraer', 'Engenharia Digital', 'Frente de atuação de Engenharia Digital no cliente.', 'varella', 'Ativo', true),
('subject-mercado-marketplace', 'client-mercadolivre', 'Marketplace', 'Frente de atuação de Marketplace no cliente.', 'giullia', 'Ativo', true),
('subject-vivo-channels', 'client-vivo', 'Canais Digitais', 'Frente de atuação de Canais Digitais no cliente.', 'cris', 'Ativo', true),
('subject-vivo-data', 'client-vivo', 'Dados', 'Frente de atuação de Dados no cliente.', 'cris', 'Ativo', false),
('subject-globo-streaming', 'client-globo', 'Streaming', 'Frente de atuação de Streaming no cliente.', 'cris', 'Em evolução', false),
('subject-localiza-mobility', 'client-localiza', 'Mobilidade Digital', 'Frente de atuação de Mobilidade Digital no cliente.', 'gabriela', 'Ativo', true),
('subject-fleury-patient', 'client-fleury', 'Jornada do Paciente', 'Frente de atuação de Jornada do Paciente no cliente.', 'gege', 'Atenção', false),
('subject-raizen-energy', 'client-raizen', 'Energia Digital', 'Frente de atuação de Energia Digital no cliente.', 'bresciani', 'Ativo', true),
('subject-suzano-industry', 'client-suzano', 'Indústria 4.0', 'Frente de atuação de Indústria 4.0 no cliente.', 'andreia', 'Planejado', false),
('subject-randon-industry', 'client-randon', 'Indústria 4.0', 'Frente de atuação de Indústria 4.0 no cliente.', 'orion', 'Em evolução', false),
('subject-santander-checking', 'client-santander', 'Conta Corrente', 'Frente de atuação de Conta Corrente no cliente.', 'fernanda', 'Ativo', true),
('subject-santander-investments', 'client-santander', 'Investimentos', 'Frente de atuação de Investimentos no cliente.', 'fernanda', 'Ativo', true),
('subject-santander-credit', 'client-santander', 'Crédito', 'Frente de atuação de Crédito no cliente.', 'fernanda', 'Ativo', false),
('subject-hapvida-patient', 'client-hapvida', 'Jornada do Paciente', 'Frente de atuação de Jornada do Paciente no cliente.', 'bruno', 'Atenção', false),
('subject-serpro-government', 'client-serpro', 'Governo Digital', 'Frente de atuação de Governo Digital no cliente.', 'bonfim', 'Ativo', true),
('subject-nubank-checking', 'client-nubank', 'Conta Corrente', 'Frente de atuação de Conta Corrente no cliente.', 'paula', 'Ativo', true),
('subject-nubank-cards', 'client-nubank', 'Cartões', 'Frente de atuação de Cartões no cliente.', 'paula', 'Ativo', false),
('subject-nubank-credit', 'client-nubank', 'Crédito', 'Frente de atuação de Crédito no cliente.', 'paula', 'Em evolução', false),
('subject-contaazul-finance', 'client-contaazul', 'Gestão Financeira', 'Frente de atuação de Gestão Financeira no cliente.', 'balista', 'Planejado', false)
on conflict (id) do nothing;

alter table public.areas add column if not exists created_at timestamptz not null default now();
alter table public.areas add column if not exists updated_at timestamptz not null default now();
alter table public.people add column if not exists created_at timestamptz not null default now();
alter table public.people add column if not exists updated_at timestamptz not null default now();
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.customers add column if not exists updated_at timestamptz not null default now();
alter table public.subjects add column if not exists created_at timestamptz not null default now();
alter table public.subjects add column if not exists updated_at timestamptz not null default now();

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

create or replace function public.audit_delivery_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  insert into public.audit_log(table_name, record_id, operation, old_data, new_data, changed_by)
  values (tg_table_name, coalesce(new_row ->> 'id', old_row ->> 'id'), tg_op, old_row, new_row, auth.uid());
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['areas', 'people', 'customers', 'subjects']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
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
alter table public.audit_log enable row level security;

drop policy if exists "Prototype full access areas" on public.areas;
drop policy if exists "Prototype full access people" on public.people;
drop policy if exists "Prototype full access territories" on public.territories;
drop policy if exists "Prototype full access customers" on public.customers;
drop policy if exists "Prototype full access subjects" on public.subjects;
drop policy if exists "BRQ access areas" on public.areas;
drop policy if exists "BRQ access people" on public.people;
drop policy if exists "BRQ access territories" on public.territories;
drop policy if exists "BRQ access customers" on public.customers;
drop policy if exists "BRQ access subjects" on public.subjects;

revoke all on public.areas, public.people, public.territories, public.customers, public.subjects, public.app_users, public.audit_log from anon;
grant usage on schema public to authenticated;
grant select on public.areas, public.people, public.territories, public.customers, public.subjects to authenticated;
grant insert, update, delete on public.areas, public.people, public.territories, public.customers, public.subjects to authenticated;
grant select, update on public.app_users to authenticated;
grant select on public.audit_log to authenticated;

create policy "Active BRQ users read areas" on public.areas for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage areas" on public.areas for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Active BRQ users read people" on public.people for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage people" on public.people for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Active BRQ users read territories" on public.territories for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage territories" on public.territories for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Active BRQ users read customers" on public.customers for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage customers" on public.customers for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Active BRQ users read subjects" on public.subjects for select to authenticated using (public.is_active_brq_user());
create policy "Editors manage subjects" on public.subjects for all to authenticated using (public.can_edit_delivery_data()) with check (public.can_edit_delivery_data());
create policy "Users read own access" on public.app_users for select to authenticated using (user_id = auth.uid() or public.is_delivery_admin());
create policy "Admins manage access" on public.app_users for update to authenticated using (public.is_delivery_admin()) with check (public.is_delivery_admin());
create policy "Admins read audit" on public.audit_log for select to authenticated using (public.is_delivery_admin());
