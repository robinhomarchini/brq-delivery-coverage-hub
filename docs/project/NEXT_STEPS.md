# Next Steps

Gerado em: 2026-07-28 13:19:26 -03:00

## Prioridade alta

1. Revisar e fechar as alteracoes pendentes de dashboard metrics.
   - Arquivos: `src/lib/dashboardMetrics.ts`, `src/components/dashboard/executive-dashboard.tsx`, `scripts/verify-dashboard-metrics.cjs`, `scripts/smoke-critical.mjs`.
   - Validar coerencia entre dashboard executivo, baseline vs cadastro e relatorio oficial.

2. Atualizar ou arquivar documentacao antiga conflitante.
   - Arquivos: `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `README.md`, `docs/agent-handoff.md`.

3. Garantir regra unica de Studio contido em todos os relatorios e dashboards.
   - Fontes atuais: `src/lib/customer-target-total.ts`, `src/lib/reports/**`, `src/lib/customers/customer-coverage-view-model.ts`.

4. Rodar quality gate completo antes de qualquer deploy.
   - `npm run lint`
   - `npm run typecheck`
   - `npm run validate`
   - `npm run build`

## Prioridade media

5. Instrumentar BFF de cliente com telemetria estruturada.
   - Arquivo: `src/app/api/delivery/customers/route.ts`.

6. Formalizar saneamento de dados legados e duplicatas.
   - Fonte: migration `20260722193000_prevent_duplicate_revenue_target_allocations.sql` e `src/app/auditoria-duplicatas/page.tsx`.

7. Consolidar regras de relatorio em modulos de dominio menores.
   - Candidatos: `src/lib/reports/person-target-official-export.ts`, `src/lib/reports/person-target-rollups.ts`.

8. Definir semantica de remuneracao na analise de desafio.
   - Arquivos: `src/lib/challenge-analysis.ts`, tipos de compensation e migrations.

## Prioridade baixa

9. Criar suite visual/UX para cards financeiros e tabelas empilhadas.
   - Componentes: `src/components/shared/kpi-summary-card.tsx`, `src/components/shared/stacked-comparison-cell.tsx`, `src/components/shared/sortable-table-head.tsx`.

10. Avaliar sink externo de observabilidade.
    - Fonte atual: `src/server/observability/telemetry.ts`.

11. Documentar estrategia futura de adapter SQL Server.
    - Base: `DeliveryRepository` e plano anti-lock-in existente.
