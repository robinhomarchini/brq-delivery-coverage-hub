-- Run after the additive migration with: supabase test db --linked <this file>.
-- All fixtures, audit events, helpers and optional extension installation roll
-- back. No existing operational record is modified; no fixture identity is output.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;
select plan(33);

create temporary table business_area_fixture as
select role_name, gen_random_uuid() as user_id,
       'business-area-test-' || gen_random_uuid()::text as person_id,
       'business-area-test-' || gen_random_uuid()::text || '@brq.com' as email
from unnest(array['admin', 'editor', 'hunter_viewer', 'viewer']) as role_name;
grant select on business_area_fixture to authenticated, anon;

insert into auth.users(id, email)
select user_id, email from business_area_fixture;
insert into public.app_users(user_id, email, role, active)
select user_id, email, role_name, true from business_area_fixture
on conflict (user_id) do update set role = excluded.role, active = true;

insert into public.people(id, name, email, job_title, role_type, active, is_manager, hierarchy_level)
select person_id, 'Business area regression fixture', email, 'Regression fixture',
       case when role_name = 'hunter_viewer' then 'Hunter' else 'Staff' end,
       true, false, 3
from business_area_fixture where role_name in ('admin', 'hunter_viewer');

create temporary table business_area_customer as
select 'business-area-test-' || gen_random_uuid()::text as customer_id;
grant select on business_area_customer to authenticated, anon;
insert into public.customers(id, name, industry, director_responsible_id)
select c.customer_id, c.customer_id, 'Regression fixture', f.person_id
from business_area_customer c cross join business_area_fixture f
where f.role_name = 'admin';
insert into public.person_customer_assignments(person_id, customer_id, source)
select f.person_id, c.customer_id, 'regression_test'
from business_area_fixture f cross join business_area_customer c
where f.role_name = 'admin';

-- Helpers are invokers: only JWT claims change; table/RPC access still runs as
-- the actual authenticated/anon database role selected below.
create function pg_temp.business_area_claims(p_role text) returns void
language plpgsql security invoker as $$
begin
  perform set_config('request.jwt.claims',
    (select json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text
     from pg_temp.business_area_fixture where role_name = p_role), true);
end;
$$;

create function pg_temp.business_area_save(
  p_area text, p_old boolean default false, p_target text default 'admin',
  p_name text default 'Business area regression fixture', p_clear_assignments boolean default false
) returns void language plpgsql security invoker as $$
declare
  f record;
  v_customer_ids text[];
begin
  select * into strict f from pg_temp.business_area_fixture where role_name = p_target;
  v_customer_ids := case when p_clear_assignments or p_target = 'hunter_viewer'
    then '{}'::text[] else array[(select customer_id from pg_temp.business_area_customer)] end;
  if p_old then
    perform public.save_person_with_assignments(
      f.person_id, p_name, f.email, 'Regression fixture', null::text, null::text,
      case when p_target = 'hunter_viewer' then 'Hunter' else 'Staff' end,
      null::text, null::text, null::text, true, false, 3, v_customer_ids);
  else
    perform public.save_person_with_assignments(
      f.person_id, p_name, f.email, 'Regression fixture', null::text, null::text,
      case when p_target = 'hunter_viewer' then 'Hunter' else 'Staff' end,
      null::text, null::text, null::text, true, false, 3, v_customer_ids, p_area);
  end if;
end;
$$;

-- pgTAP keeps counters/results in this session's temporary schema. Role
-- simulation must be able to update that test-only state, never domain grants.
do $$
declare
  v_temp_schema name;
begin
  select nspname into strict v_temp_schema
    from pg_catalog.pg_namespace where oid = pg_catalog.pg_my_temp_schema();
  execute format('grant usage on schema %I to authenticated, anon', v_temp_schema);
  execute format('grant all on all tables in schema %I to authenticated, anon', v_temp_schema);
  execute format('grant all on all sequences in schema %I to authenticated, anon', v_temp_schema);
end;
$$;

select ok(has_function_privilege('authenticated',
  'public.save_person_with_assignments(text,text,text,text,text,text,text,text,text,text,boolean,boolean,integer,text[],text)',
  'EXECUTE'), 'authenticated may execute new overload');
select ok(not has_function_privilege('anon',
  'public.save_person_with_assignments(text,text,text,text,text,text,text,text,text,text,boolean,boolean,integer,text[],text)',
  'EXECUTE'), 'anon cannot execute new overload');
select ok((select not prosecdef and pronargdefaults = 0
  from pg_proc where oid = 'public.save_person_with_assignments(text,text,text,text,text,text,text,text,text,text,boolean,boolean,integer,text[],text)'::regprocedure),
  'new overload is invoker without ambiguous defaults');
select ok(not exists (
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.oid = 'public.save_person_with_assignments(text,text,text,text,text,text,text,text,text,text,boolean,boolean,integer,text[],text)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'
), 'PUBLIC has no execute grant on new overload');

set local role authenticated;
select pg_temp.business_area_claims('admin');
select ok(public.can_write_delivery_hardening(), 'admin fixture has canonical write permission');
select lives_ok($$select pg_temp.business_area_save('Vendas')$$, 'admin saves Vendas');
select ok((select business_area = 'Vendas' from public.people where id =
  (select person_id from pg_temp.business_area_fixture where role_name = 'admin')), 'Vendas persisted');
select lives_ok($$select pg_temp.business_area_save(null, true)$$, 'old fourteen argument overload still works');
select ok((select business_area = 'Vendas' from public.people where id =
  (select person_id from pg_temp.business_area_fixture where role_name = 'admin')), 'old overload preserves classification');
select lives_ok($$select pg_temp.business_area_save('Delivery')$$, 'admin saves Delivery');
select ok((select business_area = 'Delivery' from public.people where id =
  (select person_id from pg_temp.business_area_fixture where role_name = 'admin')), 'Delivery persisted');
select lives_ok($$select pg_temp.business_area_save('Outras')$$, 'admin saves Outras');
select ok((select business_area = 'Outras' from public.people where id =
  (select person_id from pg_temp.business_area_fixture where role_name = 'admin')), 'Outras persisted');
select lives_ok($$select pg_temp.business_area_save(null)$$, 'admin clears classification');
select ok((select business_area is null from public.people where id =
  (select person_id from pg_temp.business_area_fixture where role_name = 'admin')), 'cleared classification is SQL null');
select throws_ok($$select pg_temp.business_area_save('Invalid', false, 'admin', 'Must roll back', true)$$,
  '23514', null, 'invalid enum rejects complete command');
select ok((select name = 'Business area regression fixture' and business_area is null
  from public.people where id = (select person_id from pg_temp.business_area_fixture where role_name = 'admin')),
  'invalid command preserves profile and classification');
select ok((select count(*) = 1 from public.person_customer_assignments
  where person_id = (select person_id from pg_temp.business_area_fixture where role_name = 'admin')
    and customer_id = (select customer_id from pg_temp.business_area_customer)),
  'invalid command preserves existing assignment');
select throws_ok($$update public.people set business_area = 'Invalid'
  where id = (select person_id from pg_temp.business_area_fixture where role_name = 'admin')$$,
  '23514', null, 'table constraint also rejects direct invalid enum');

select pg_temp.business_area_claims('editor');
select ok(public.can_write_delivery_hardening(), 'editor fixture has canonical write permission');
select lives_ok($$select pg_temp.business_area_save('Delivery')$$, 'editor may classify people');
select lives_ok($$select pg_temp.business_area_save('Vendas', false, 'hunter_viewer')$$, 'editor classifies Hunter fixture');

select pg_temp.business_area_claims('hunter_viewer');
select ok(not public.can_write_delivery_hardening() and public.current_hunter_access_person_id() is not null,
  'Hunter fixture resolves own scope without editor permission');
select lives_ok($$select pg_temp.business_area_save('Vendas', false, 'hunter_viewer', 'Hunter unchanged classification')$$,
  'Hunter self profile save preserves unchanged classification');
select throws_ok($$select pg_temp.business_area_save('Outras', false, 'hunter_viewer', 'Must roll back')$$,
  '42501', null, 'Hunter cannot change own classification through RPC');
select throws_ok($$update public.people set business_area = 'Outras'
  where id = (select person_id from pg_temp.business_area_fixture where role_name = 'hunter_viewer')$$,
  '42501', null, 'Hunter cannot bypass RPC with direct own-row update');
select throws_ok($$select pg_temp.business_area_save(null, false, 'hunter_viewer')$$,
  '42501', null, 'Hunter cannot clear own classification');
select throws_ok($$select pg_temp.business_area_save('Delivery')$$,
  '42501', null, 'Hunter cannot update another person');
select ok((select business_area = 'Vendas' and name = 'Hunter unchanged classification'
  from public.people where id = (select person_id from pg_temp.business_area_fixture where role_name = 'hunter_viewer')),
  'denied Hunter commands leave own profile unchanged');

select pg_temp.business_area_claims('viewer');
select throws_ok($$select pg_temp.business_area_save('Outras')$$,
  '42501', null, 'viewer cannot classify through RPC');
with attempted as (
  update public.people set business_area = 'Outras'
  where id = (select person_id from pg_temp.business_area_fixture where role_name = 'admin') returning id
) select ok((select count(*) = 0 from attempted), 'viewer direct update affects zero rows under RLS');

set local role anon;
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
select throws_ok($$select pg_temp.business_area_save('Outras')$$,
  '42501', null, 'anon cannot call new overload');
select throws_ok($$update public.people set business_area = 'Outras'
  where id = (select person_id from pg_temp.business_area_fixture where role_name = 'admin')$$,
  '42501', null, 'anon cannot update people directly');

reset role;
-- finish(true) raises on failed assertions or a plan mismatch, so direct CLI
-- query runners cannot treat hidden "not ok" TAP output as a successful suite.
-- https://pgtap.org/documentation.html (planning and finish)
select * from finish(true);
rollback;
