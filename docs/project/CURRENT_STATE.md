# Current State

Gerado em: 2026-07-28 14:30:00 -03:00

## Git

- Branch: `main`.
- HEAD: `f08bfd6 refactor(dashboard): centralize executive metric calculations`.
- Ultimos commits relevantes:
  - `f08bfd6 refactor(dashboard): centralize executive metric calculations`
  - `a43e995 feat(observability): instrument target saves and challenge analysis`
  - `9db627f feat(audit): add traceability for person targets`

## Metric Layer SQL (novo)

- View: `vw_customer_dashboard_metrics` criada em `20260728143000_replace_dashboard_view_and_rpc.sql`.
- RPC: `get_executive_dashboard_summary()` estendido em `20260728144000_dashboard_metric_rpc_org_counts.sql` e corrigido em `20260728144500_dashboard_metric_rpc_org_counts_fix.sql`.
- Metricas: `totalTarget`, `boardTotalTarget`, `hunterTarget`, `farmerRenewalTarget`, `allocatedPeopleTotal`, `peopleDelta`, `achievementPercentage`, `customerCount`, `activePeopleCount`, `directorCount`, `managerCount`.
- Todos usam `SECURITY INVOKER` e respeitam RLS das tabelas subjacentes.
- Nenhum indice extra criado (plano `EXPLAIN ANALYZE` nao justifica indexes adicionais; scans sao baratos em volume atual).
- Nenhum view materializada criada.
- Nenhuma aplicacao em producao.

## Worktree artefatos pendentes

- `AGENTS.md` - modificado (reduzido para versao simplificada).
- `docs/agent-handoff.md` - atualizado para epic de dashboard.
- `next-env.d.ts` - ajuste menor de tipagem do Next.js.
- `docs/project/` - documentacao operacional criada.
- `supabase/migrations/20260728143000_replace_dashboard_view_and_rpc.sql` - novo.
- `supabase/migrations/20260728144000_dashboard_metric_rpc_org_counts.sql` - novo.
- `supabase/migrations/20260728144500_dashboard_metric_rpc_org_counts_fix.sql` - novo.
- `src/lib/repositories/` - adaptador adicionou `getDashboardSummary` e contadores organizacionais.
- `src/hooks/useDashboardSummary.ts` - novo hook de consumo.
- `src/components/dashboard/executive-dashboard.tsx` - migrado para hook/RPC com fallback.
- `scripts/verify-dashboard-metric-reconciliation.ts` - reconciliacao local vs SQL (TS).
- `scripts/verify-dashboard-metric-layer.cjs` - verificacao de invariantes.
- `scripts/verify-dashboard-metric-rls.mjs` - smoke test RLS para dashboard RPC.

## Estado dos documentos

- `docs/agent-handoff.md` reflete o epic Dashboard Baseline and Metric Integrity.
- `docs/project/` e a base de conhecimento operacional para proximos agentes.

## Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run validate`: passou.
- `npm run test:contracts`: passou.
- `npm run test:roles`: passou.
- `npm run test:customer-scope`: passou.
- `npm run test:reports`: passou.
- `npm run test:dashboard-metrics`: passou.

## Validacoes pendentes

- `npm run smoke:critical` (nao afetado por mudancas de banco/view).
- `npm run db:migrations:check` para verificar alinhamento local/remoto antes de aplicar.
- Reconciliacao do RPC com calculos locais em Supabase real.

## Deploy

- Nenhum deploy realizado.
- Nenhuma migration aplicada em producao.

## Analise de Desafio - conversa e voz

- A conversa GEN AI mantem historico recente por visao/ano apenas durante a
  sessao da tela e envia esse contexto para a rota backend nas reavaliacoes.
- Pesquisa web passou a ser solicitada por opcao explicita e a resposta informa
  se a pesquisa foi usada ou ficou indisponivel.
- Fallback deterministico nao apaga a pergunta digitada nem se apresenta como
  pesquisa externa concluida.
- Reconhecimento de voz diferencia permissao bloqueada, ausencia de fala,
  microfone indisponivel, interrupcao e indisponibilidade do servico.
- Nenhuma conversa, contexto de voz ou resultado externo e persistido no banco.
