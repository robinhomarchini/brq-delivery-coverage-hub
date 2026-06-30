-- Seed Delivery Studios / Areas as canonical operational data.
-- They feed people.area_id and downstream org chart / target views.

insert into public.areas (id, name, description)
values
  ('area-aliancas', 'Alianças', 'Parcerias, alianças estratégicas e ecossistema.'),
  ('area-px', 'PX', 'People Experience e práticas de experiência.'),
  ('area-mobile', 'Mobile', 'Produtos e soluções mobile.'),
  ('area-ba', 'BA', 'Business Analysis e discovery funcional.'),
  ('area-ia', 'IA', 'Inteligência Artificial, automação e agentes.'),
  ('area-dados', 'Dados', 'Dados, analytics, engenharia e governança.')
on conflict (id) do update
set name = excluded.name,
    description = excluded.description;

select id, name, description
from public.areas
where id in ('area-aliancas', 'area-px', 'area-mobile', 'area-ba', 'area-ia', 'area-dados')
order by name;
