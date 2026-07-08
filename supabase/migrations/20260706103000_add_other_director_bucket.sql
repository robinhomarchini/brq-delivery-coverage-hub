insert into public.areas (id, name, description)
values (
  'area-corporate',
  'Estratégia & Operações',
  'Gestão executiva, operações e pré-vendas.'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.people (
  id,
  name,
  email,
  job_title,
  director_id,
  manager_id,
  role_type,
  area_id,
  client_ids,
  photo_url,
  notes,
  active,
  is_manager,
  hierarchy_level,
  lifecycle_status,
  closed_at,
  closed_reason
) values (
  'director-other',
  'Outros',
  'outros@brq.com',
  'Diretoria a definir',
  null,
  null,
  'Director',
  'area-corporate',
  '{}',
  null,
  'Bucket transitório para clientes ainda sem diretoria definida. Não recebe meta direta.',
  true,
  false,
  2,
  'active',
  null,
  null
)
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  job_title = excluded.job_title,
  director_id = excluded.director_id,
  manager_id = excluded.manager_id,
  role_type = excluded.role_type,
  area_id = excluded.area_id,
  notes = excluded.notes,
  active = excluded.active,
  is_manager = excluded.is_manager,
  hierarchy_level = excluded.hierarchy_level,
  lifecycle_status = excluded.lifecycle_status,
  closed_at = excluded.closed_at,
  closed_reason = excluded.closed_reason;
