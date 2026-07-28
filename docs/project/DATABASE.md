# Database

Gerado em: 2026-07-28 13:19:26 -03:00

## Backend atual

- Banco atual: Supabase/Postgres.
- Migrations versionadas: `supabase/migrations/*.sql`.
- Cliente Supabase: `src/lib/supabase/client.ts`.
- Adaptador Supabase: `src/lib/repositories/supabase.ts`.
- Provider de persistencia: `src/lib/repositories/provider.ts`.

## Tabelas principais confirmadas

- `people`: pessoas, papel, hierarquia e dados operacionais.
- `customers`: clientes.
- `person_customer_assignments`: relacao pessoa-cliente.
- `customer_target_years`: metas anuais por cliente, incluindo New Logo/fora da meta via `counts_toward_target`.
- `revenue_target_allocations`: metas por pessoa, cliente, ano e tipo.
- `studio_target_allocations`: alocacoes por cliente, area/studio, responsaveis e ano.
- `specialist_hunter_studio_assignments`: relacao Hunter Especializado com cliente/studio.
- `board_target_baselines`: baseline do board.
- `target_baseline_snapshots`: fotos de baseline de clientes.
- `studio_baseline_snapshots`: fotos de baseline de studios.
- `person_compensations`: remuneracao usada na analise de desafio.
- `app_users` e `app_access_invites`: RBAC da aplicacao.
- `domain_audit_events`: trilha de auditoria.

## RPCs e funcoes relevantes

- `accept_current_app_access`: resolve permissao atual.
- `save_person_with_assignments`: salva pessoa com validacoes e escopo.
- `save_customer_with_managers_and_targets`: salva cliente, gestores e metas.
- Funcoes de escopo hunter em `20260721103000_hunter_scoped_access.sql`.
- Funcoes/triggers de auditoria em `20260728113530_add_app_access_domain_audit.sql` e `20260728120500_add_person_target_domain_audit.sql`.

## Constraints e protecoes confirmadas

- Constraints de `people.role_type` preservam valores persistidos.
- Trigger evita duplicidade de `revenue_target_allocations` por cliente + pessoa + tipo + ano, conforme `20260722193000_prevent_duplicate_revenue_target_allocations.sql`.
- `customer_target_years` valida motivo quando cliente nao conta para meta.
- RLS protege tabelas sensiveis e varia por perfil admin/editor/viewer/hunter.
- `person_compensations` e acessada via BFF protegido para analise de desafio.

## Riscos de consistencia

- Existem mudancas nao commitadas em calculos de dashboard; ainda nao devem ser assumidas como baseline validado.
- Pode haver dados legados que passaram a ser invalidos apos triggers de duplicidade. A tela temporaria de auditoria nao substitui migracao/saneamento formal.
- Relatorios dependem de regras de contencao de Studios; qualquer divergencia entre relatorio, dashboard e tela de cliente gera risco financeiro.

## Operacao Supabase

- Caminho aprovado neste projeto: `npx --cache .npm-cache --yes supabase <command> --linked`.
- Para banco/RLS/RPC, rode `npm run db:migrations:check`.
- Nao usar reset, repair ou SQL manual sem verificar historico de migrations e obter aprovacao explicita.
