# Agent Handoff — BRQ Delivery Coverage Hub

Artefato oficial de coordenacao entre Codex, Kilo, ChatGPT e outros agentes de engenharia. Manter factual, curto, baseado no repositorio e sem segredos, logs transientes ou conclusoes especulativas.

## 1. Metadata

- Atualizado em: 2026-07-31 15:30:00 -03:00
- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`
- Raiz local: `C:\Users\rmarchini\projetos\OrgBRQDelivery`
- Branch: `main`
- HEAD atual: `c82c795 docs: update RPC contract inventory and current state for Database Contract Hardening epic`
- Ultimo commit de produto confirmado nesta sessao: `c82c795`
- Baseline de producao conhecida: nao verificado nesta sessao; valor historico conhecido era `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- URL de producao conhecida: `https://brq-delivery-coverage-hub.vercel.app`
- Agente gerador: Kilo
- Proximo agente previsto: Kilo, Codex ou ChatGPT

## 2. Git status verificado

- `git status --short` apos o commit `a43e995`: limpo antes desta atualizacao final de handoff.
- Commit do incremento atual de observabilidade: `a43e995 feat(observability): instrument target saves and challenge analysis`.
- Deploy Vercel executado em producao: `dpl_651kV3AADK5ojmXrdfqQBbCqxWyf`.
- URL inspecionada: `https://brq-delivery-coverage-hub.vercel.app`.
- Status do deployment inspecionado: Ready.

## 3. Objetivo atual

Epic: Database Contract Hardening — Typed RPCs and Runtime Validation.

Hardening do contrato entre PostgreSQL/Supabase e TypeScript. Garantir que RPCs tabulares usem saidas SQL tipadas, JSON hierarquico seja validado em runtime, tipos Supabase refletam o contrato real, repositorios mapeiem respostas em DTOs estaveis e frontend nunca consuma payloads brutos. Ver faseamento em `docs/epics/database-contract-hardening-phases.md` (referenciado abaixo).

## 4. Capacidades implementadas

### Database Contract Hardening (inicio: 2026-07-29)

1. Inventario completo de RPCs: nome, proposito, return type, consumidores, classificacao (RETURNS TABLE, SCALAR, HIERARCHICAL_JSON, MUTATION_COMMAND, etc.), risco e recomendacao de contrato.
2. `get_dashboard_performance_by_customer_v2`: migration `20260729240000` criada e aplicada; repositório `SupabaseDeliveryRepository.getPerformanceByCustomer` atualizado para consumir linhas tipadas (RETURNS TABLE).
3. `validateDashboardMetricResult` adicionada em `src/lib/repositories/types.ts` para validar o payload JSON de `get_executive_dashboard_summary` (sumario + financialByCustomer) na fronteira do repositório. Cast cego e fallback hardcoded removidos.
4. `apply_employee_import_batch_v2`: migration `20260729241000` criada e aplicada; `service.ts` atualizada para consumir typed returns (headcounts_updated, status, salaries_updated) sem cast jsonb.
5. `validateRpcObject` centralizada em `src/server/employee-import/service.ts`; casts `as Record<string, unknown>` removidos de `applyEmployeeImportSalaryItem`, `applyAllEmployeeImportBatch` (ja usa v2), `confirmEmployeeImportHeadcount` e `buildEmployeeImportPreview`.
6. Inventario de contratos RPC e classificacao documentados em `docs/project/DECISIONS.md`.
7. Estado atualizado em `docs/project/CURRENT_STATE.md`.

## 5. Arquitetura da camada de métricas

Modulo novo:

- `src/lib/dashboardMetrics.ts`

Função principal:

- `buildDashboardData(people, customers, customerTargets, targetAllocations, studioTargetAllocations, boardTargetBaselines, areas, filters)`: retorna `DashboardData` com resumo executivo, dados financeiros por cliente/diretor/manager, distribuição por perfil, contagem de clientes por responsável e alertas de gestão.

Contrato de filtros (`DashboardFilters`):

- `includeNewLogos`: boolean — controla se new logos entram no escopo de métricas.
- `hunterScope`: `HunterAccessScope` — controla o escopo de acesso do hunter consult.
- `targetYear`: number — ano de referência para metas (padrão: 2026).

Métricas canônicas:

| Métrica | Label | Fonte | Filtros |
|---|---|---|---|
| totalTarget | Meta Board | Board baseline + getCustomerTotalTarget | includeNewLogos, hunterScope, targetYear |
| hunterTarget | Board Hunter | Board baseline | idem |
| farmerRenewalTarget | Board Renov. + Ampl. | Board baseline | idem |
| allocatedPeopleTotal | Alocado em Pessoas | getCustomerCoverageAllocatedTotal | idem |
| peopleDelta | Dif. Pessoas x Board | allocatedPeopleTotal - totalTarget | idem |
| achievementPercentage | Atingimento | (allocatedPeopleTotal / totalTarget) * 100 | idem |
| customerCount | Clientes | dashboardCustomers.length | idem |
| activePeopleCount | Pessoas Ativas | activePeople.length | idem |

## 6. Divergências identificadas e resolvidas

- O dashboard anterior não tinha métrica de "receita atual" — apenas "alocado em pessoas" (que é alocação de metas, não receita real). Mantido o comportamento atual e documentado.
- O dashboard anterior não tinha porcentagem de atingimento — adicionada como métrica derivada.
- O dashboard anterior não tinha seção de alertas — adicionada com verificações estruturais de qualidade de dados.
- O dashboard anterior não tinha estados de loading/empty/error — adicionados.
- O dashboard anterior não tinha drill-down — mantido sem links de navegação por enquanto (requer decisão de negócio sobre quais destinos usar).

## 7. Arquivos modificados

- `src/lib/dashboardMetrics.ts` (novo) — camada canonical de métricas
- `src/components/dashboard/executive-dashboard.tsx` — reestruturado para usar a camada de métricas
- `scripts/verify-dashboard-metrics.cjs` (novo) — testes de contrato de métricas
- `scripts/smoke-critical.mjs` — atualizado para verificar a camada de métricas
- `scripts/verify-performance-hardening.cjs` — atualizado para a nova arquitetura

## 8. Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run test:contracts`: passou.
- `npm run test:roles`: passou.
- `npm run test:customer-scope`: passou.
- `npm run test:reports`: passou.
- `npm run test:performance`: passou.
- `npm run test:security`: passou.
- `npm run smoke:critical`: passou.
- `npm run build`: passou.
- `npm run validate`: passou.
- `npm run deploy:check`: passou.

Pendencias nesta fatia:

- Testes de componentes UI (não há framework de testes React instalado no projeto).
- Validação manual da UX (requer execução local do Next.js dev server).
- Drill-down traceability (requer decisão de negócio sobre destinos de navegação).

## 9. Riscos e pendencias

- A métrica "Alocado em Pessoas" reflete alocação de metas, não receita real. O nome pode ser confuso para executivos.
- O drill-down do dashboard para relatórios detalhados ainda não está implementado (sem links de navegação).
- A seção de alertas usa regras estruturais simples; thresholds de negócio não foram estabelecidos para alertas de concentração.
- O AGENTS.md foi modificado por um agente anterior (alterações não relacionadas ao dashboard) — estas não estão incluídas no commit do dashboard.

## 10. Proxima recomendacao

Boundary de commit recomendado para a fatia atual:

`refactor(dashboard): centralize executive metric calculations`

Proximo incremento recomendado:

1. Configurar usuarios RLS de teste (`SUPABASE_RLS_*_EMAIL`/`SUPABASE_RLS_*_PASSWORD`) para validar reconciliacao automatizada.
2. Revisar plano do RPC: `EXPLAIN ANALYZE` mediu ~2.4ms para CTEs financeiras; nao ha justificativa para indexes adicionais nesta fase.
3. Expandir reconcilicao para comparar `activePeopleCount`, `directorCount`, `managerCount` entre RPC e dominio local.
4. Decidir fonte canonica de `current_revenue` antes de exibir cartao correspondente.
5. Migrar charts e drill-down adicionais gradualmente, comecando por consumidores de baixo risco.
6. Validar manualmente os cards, filtros e charts no dev server local.

## 10. Metric Layer SQL (novo epic)

Objetivo: camada metrico no Supabase para o dashboard executivo, com reconciliacao e anti-duplicacao.

### Semantica confirmada

- **Meta oficial/autoritativa**: `board_target_baselines.total_target` quando `scenario='board_approved'` e `approved=true`; fallback para `customer_target_years.revenue` quando nao houver baseline.
- **Baseline Board**: `board_target_baselines.total_target` (= hunter_target + farmer_renewal_target).
- **Alocacoes por pessoa**: `revenue_target_allocations` — ja contem studio Hunter/manutencao (contained), nao somar novamente.
- **Alocacoes por area/studio**: `studio_target_allocations` — quebra da `customer_target_years.studio_target`.
- **Receita atual**: nao existe fonte no banco; apenas mock em `src/data/customerPortfolioData.ts`.

### Arquivos criados/modificados

1. `supabase/migrations/20260728140000_dashboard_customer_metric_view.sql` — view inicial `vw_customer_dashboard_metrics` (movida para historico).
2. `supabase/migrations/20260728140500_dashboard_executive_summary_rpc.sql` — RPC inicial `get_executive_dashboard_summary()` (movida para historico).
3. `supabase/migrations/20260728143000_replace_dashboard_view_and_rpc.sql` — substituto atomico: view + RPC alinhados.
4. `supabase/migrations/20260728144000_dashboard_metric_rpc_org_counts.sql` — extend RPC com contadores organizacionais.
5. `supabase/migrations/20260728144500_dashboard_metric_rpc_org_counts_fix.sql` — corrige colunas `role_type`/`is_manager` no CTE `people_scope`.
6. `src/lib/repositories/types.ts` — tipos `DashboardMetricResult`, `DashboardSummaryFilters` com contadores organizacionais.
7. `src/lib/repositories/supabaseDeliveryRepository.ts` — implementacao do RPC com `p_hunter_person_id`.
8. `src/lib/repositories/localDeliveryRepository.ts` — fallback via `buildDashboardData` com contadores.
9. `src/hooks/useDashboardSummary.ts` — hook de consumo do RPC no dashboard.
10. `src/components/dashboard/executive-dashboard.tsx` — resumo executivo migrado para o hook/RPC com fallback.
11. `scripts/verify-dashboard-metric-reconciliation.ts` — reconciliacao local vs SQL (TS).
12. `scripts/verify-dashboard-metric-layer.cjs` — verificacao de invariantes.
13. `scripts/verify-dashboard-metric-rls.mjs` — smoke test RLS para o dashboard RPC.
14. `package.json` — comandos de teste e verificacao atualizados.

### Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run validate`: passou.
- `npm run test:contracts`: passou.
- `npm run test:roles`: passou.
- `npm run test:customer-scope`: passou.
- `npm run test:reports`: passou.
- `npm run smoke:critical`: passou.
- `npm run db:migrations:check`: passou (90 migrations locais = 90 remote).
- `node scripts/verify-dashboard-metric-layer.cjs`: skip por ausencia de usuario RLS autenticado.

### Pendencias

- Reconciliacao automatizada com Supabase autenticado (script atual pula por falta de usuario RLS configurado).
- Validacao manual da UI com dev server comecou; precisa confirmar cards, filtros, estados e charts.
- Investigacao de `current_revenue`: `revenue_plans` existe no banco mas carece de processo de atualizacao documentado.

## 4. Capacidade instrumentada

Capacidades instrumentadas nesta fatia:

1. Salvar Metas por Pessoa.
2. Gerar Analise de Desafio / GEN AI.

Pontos instrumentados:

- `POST /api/delivery/person-customer-targets`
- `POST /api/challenge-analysis`

Motivo:

- Metas por Pessoa: fluxo frequente e sensivel; envolve Auth, app access, escopo Hunter, Repository, Supabase/RLS e persistencia de metas; afeta dashboards, relatorios e batimentos.
- Analise de Desafio: envolve autorizacao de remuneracao, dados agregados de pessoas, chamada de IA/fallback e custo/latencia externa.

## 5. Arquitetura de telemetria

Modulo novo:

- `src/server/observability/telemetry.ts`

Componentes:

- `OperationTimer`: mede duracao total e fases internas.
- `OperationTracker`: emite eventos de ciclo de vida.
- `startOperation`: cria operacao com correlation id.
- `getCorrelationId`: reaproveita `x-correlation-id` ou `x-request-id`, senao cria UUID.
- `withCorrelationHeader`: devolve `x-correlation-id` na resposta.
- `hashTelemetryValue`: hash curto para dados potencialmente sensiveis.
- `categorizeTelemetryError`: classifica falhas sem expor stack/message bruto.

Eventos controlados:

- `OperationStarted`
- `OperationSucceeded`
- `OperationFailed`
- `OperationCancelled` reservado para proximos fluxos

## 6. Dados coletados

Por evento:

- `operationName`
- `capability`
- `correlationId`
- `timestamp`
- `durationMs`
- `status`
- `errorCategory`
- `user`
- `businessContext`
- `metrics`
- `phases`

Fases instrumentadas em Metas por Pessoa:

- `auth`
- `request.parse`
- `authorization.scope` quando o perfil e Consulta Hunter
- `repository.save`

Fases instrumentadas em Analise de Desafio:

- `auth`
- `request.parse`
- `analysis.prepare`
- `ai.generate`

Observacoes de seguranca:

- nao usa `console.log`;
- usa eventos JSON estruturados por `console.info`/`console.error` para integracao com logs da plataforma;
- nao registra e-mail bruto;
- nao registra `personId` bruto;
- nao registra prompt/contexto bruto da analise de desafio, apenas hash;
- nao registra valores financeiros de metas;
- erro registra `name` e hash da mensagem, nao stack trace.

## 7. Mapa de observabilidade

| Categoria | Exemplos localizados | Status |
|---|---|---|
| Authentication | Supabase Auth, app access, BFF delivery command access | parcialmente observavel no fluxo instrumentado |
| Targets | Metas por Pessoa, `revenue_target_allocations`, BFF person targets | instrumentado apenas save de Metas por Pessoa |
| Reports | Relatorio de Metas, exports CSV/Excel/oficial | sem telemetria dedicada |
| Assignments | `person_customer_assignments`, manager/hunter/customer ownership | sem telemetria dedicada |
| Portfolio | Portfolio de Clientes, dashboard financeiro | sem telemetria dedicada |
| Dashboard | Dashboard executivo e graficos | sem render/performance telemetry |
| Challenges | `/api/challenge-analysis`, IA/generativa | instrumentado no BFF de geracao/reavaliacao |
| Administration | Configuracoes/acessos | auditado, mas sem observabilidade operacional |
| Baselines/uploads | importacao de baseline, snapshots | sem telemetria dedicada |
| Exports | PDF/CSV/Excel, xlsx reader/export service | sem telemetria dedicada |

## 8. Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run test:performance`: passou.
- `npm run test:observability`: passou.
- `npm run validate`: passou.
- `npm run build`: passou.
- `npm run smoke:critical`: passou.
- `npm run test:security`: passou.
- `git diff --check`: passou.
- `npm run deploy:check`: passou.
- `npm run deploy:prod`: passou.
- `npm run deploy:inspect -- https://brq-delivery-coverage-nhinrwznc-robinsonmarchini-1717s-projects.vercel.app`: passou; alias oficial apontou para o deployment novo quando ficou Ready.

Pendencias nesta fatia:

- Nenhuma validacao obrigatoria pendente.

Nao executar sem autorizacao:

- deploy;
- aplicacao de migrations em producao.

## 9. Riscos e pendencias

- Telemetria atual vai para logs estruturados da plataforma; ainda nao ha sink externo, dashboard operacional ou tabela dedicada.
- `repository.save` mede tempo do repository/BFF interno como aproximacao de banco, nao tempo real por query/RPC.
- Frontend render duration e network latency do navegador ainda nao foram instrumentados.
- Relatorios, exports, baselines e dashboard seguem sem telemetria dedicada.

## 10. Proxima recomendacao

Boundary de commit recomendado para a fatia atual:

`refactor(employee-import): validate employee import RPC object boundaries`

Proximo incremento recomendado (Database Contract Hardening epic):

1. Criar RPCs tipadas sucessoras para `apply_employee_import_salary_item` e `confirm_employee_import_headcount` (RETURNS TABLE, wrappers sobre as JSON originais), aplicar migration e atualizar `service.ts` para consumir v2.
2. Adicionar validacao de contrato para `get_employee_import_preview_data` e `get_full_delivery_data` na fronteira do repositorio/service.
3. Investigar `apply_employee_salary_import` (jsonb) — verificar se tem consumidor TS ativo; se nao, documentar como legado.
4. Regenerar tipos Supabase via comando padrao do projeto (`npm run supabase:types` ou equivalente) para refletir as RPCs tipadas.
5. Adicionar testes de contrato SQL e runtime para os novos contratos (colunas, tipos, empty result, escopo Hunter, anonymous denial, zero target, negative delta, achievement > 100%).

## 11. Prompt de continuacao

Continue em `C:\Users\rmarchini\projetos\OrgBRQDelivery`. Leia `AGENTS.md`, `.github/copilot-instructions.md`, `docs/project/*.md`, `.squad/memory.md` e este arquivo. Carregue `.agent/skills/database-engineering-guardian/SKILL.md`. Use Git e codigo como fonte da verdade. O workstream atual e o Database Contract Hardening epic; priorize RPCs criticas de dashboard e employee-import. Nao fazer deploy sem autorizacao explicita.
