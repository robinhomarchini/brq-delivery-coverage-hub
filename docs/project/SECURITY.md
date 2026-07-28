# Security

Gerado em: 2026-07-28 13:19:26 -03:00

## Controles confirmados

- Autenticacao atual: Supabase Auth em `src/lib/auth/auth-service.ts`.
- Provider futuro `corporate-sso` existe como opcao reservada, mas nao implementada.
- Controle de acesso de aplicacao: `app_users`, `app_access_invites` e `accept_current_app_access`.
- Rotas BFF sensiveis validam token e permissao antes de mutar dados.
- RLS e policies estao em migrations Supabase.
- Headers de seguranca configurados em `next.config.ts`: `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy` e HSTS em producao.
- Auditoria de dominio existe para acesso e metas por pessoa em `domain_audit_events`.

## Regras de permissao confirmadas

- Admin/editor podem executar operacoes administrativas conforme RBAC.
- `hunter_viewer` tem escopo restrito a propria pessoa e relacoes associadas.
- Hunter scoped write pode criar cliente novo, mas nao editar cliente existente como admin/editor.
- Em metas por pessoa, hunter scoped so pode alterar a propria pessoa.
- Em studio, hunter scoped so pode alterar alocacao vinculada a ele.
- Remuneracao usada em analise de desafio requer permissao especifica.

## Fontes

- `src/server/auth/delivery-command-access.ts`
- `src/server/auth/challenge-analysis-access.ts`
- `src/app/api/delivery/customers/route.ts`
- `src/app/api/delivery/person-customer-targets/route.ts`
- `src/app/api/challenge-analysis/route.ts`
- `src/lib/hunter-access-scope.ts`
- `supabase/migrations/20260721103000_hunter_scoped_access.sql`
- `supabase/migrations/20260709102000_harden_rls_audit_for_financial_targets.sql`
- `supabase/migrations/20260728113530_add_app_access_domain_audit.sql`
- `supabase/migrations/20260728120500_add_person_target_domain_audit.sql`

## Riscos e pendencias

- Nem todas as rotas BFF usam telemetria estruturada; algumas ainda usam erro generico ou `console.error`.
- A simulacao de perfil no admin e recurso de UI/contexto e nao deve ser confundida com autenticacao real.
- Exportacoes precisam continuar evitando vazamento de dados fora do escopo do usuario logado.
- Qualquer migracao futura para SQL Server deve preservar RLS/RBAC em fronteira equivalente, nao apenas trocar adapter.
