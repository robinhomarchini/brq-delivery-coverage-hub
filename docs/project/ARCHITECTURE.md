# Architecture

Baseline atualizado em: 2026-07-31

## Camadas confirmadas

- UI Next App Router: paginas em `src/app/**/page.tsx` e componentes em `src/components/**`.
- Dominio e regras deterministicas: `src/lib/**`, com destaque para `src/lib/roles.ts`, `src/lib/customer-target-total.ts`, `src/lib/customers/customer-coverage-view-model.ts`, `src/lib/reports/**`, `src/lib/challenge-analysis.ts` e `src/lib/dashboardMetrics.ts`.
- Repositorio: `src/lib/repositories/types.ts` define `DeliveryRepository`; adaptadores em `src/lib/repositories/supabase.ts`, `src/lib/repositories/local.ts` e provider em `src/lib/repositories/provider.ts`.
- Backend/BFF: rotas `src/app/api/**/route.ts` protegem operacoes sensiveis e centralizam autorizacao para mutacoes selecionadas.
- Auth/RBAC: `src/lib/auth/auth-service.ts`, `src/server/auth/delivery-command-access.ts`, `src/server/auth/challenge-analysis-access.ts` e migrations de `app_users`.
- Banco/RLS/RPC: `supabase/migrations/*.sql`.
- Observabilidade server-side: `src/server/observability/telemetry.ts`.
- IA: `src/server/ai/challenge-analysis.ts` e `src/app/api/challenge-analysis/route.ts`.

## Fluxos principais

- Leitura geral: UI chama provider/repositorio, que escolhe Supabase ou local-dev conforme ambiente.
- Mutacao critica de cliente: `src/app/api/delivery/customers/route.ts` valida payload, autoriza usuario, aplica regras de escopo e chama repositorio Supabase.
- Mutacao critica de meta por pessoa: `src/app/api/delivery/person-customer-targets/route.ts` valida payload, aplica escopo hunter/admin e chama repositorio.
- Relatorios e exports: regras centralizadas principalmente em `src/lib/reports/person-target-official-export.ts`, `src/lib/reports/person-target-rows.ts` e `src/lib/reports/person-target-rollups.ts`.
- Dashboard: ha trabalho atual nao finalizado em `src/lib/dashboardMetrics.ts` para mover calculos para dominio.
- Baselines: importacao de curva principal e studios em `src/lib/target-baseline-import.ts`, `src/lib/studio-baseline-import.ts` e `src/lib/studio-curve-baseline-snapshot.ts`.

## Decisoes arquiteturais confirmadas

- `DeliveryRepository` e a fronteira principal de aplicacao para dados de dominio.
- Supabase/Postgres continua sendo backend atual; a arquitetura evita acoplamento direto da UI quando usa repositorio/BFF.
- `src/lib/roles.ts` e a fonte canonica TypeScript para papeis.
- `OrganizationChart` e a implementacao oficial de organograma; nao foi encontrado `OrganizationChartV2` ativo no inventario de arquivos.
- Regras financeiras compartilhadas devem ficar em dominio, nao duplicadas em componentes.
- Telemetria estruturada existe para uma parte das operacoes server-side, mas ainda nao cobre toda a aplicacao.

## Riscos arquiteturais

- Parte das regras ainda aparece em paginas/componentes grandes, principalmente relatorios, baselines e dashboards.
- BFFs nao estao igualmente instrumentados: meta por pessoa usa telemetria, cliente ainda registra erro com `console.error`.
- A camada local-dev precisa continuar isolada de producao para nao virar fallback silencioso.
