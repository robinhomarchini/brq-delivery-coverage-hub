# Current State

Gerado em: 2026-07-28 14:30:00 -03:00

## Git

- Branch: `main`.
- HEAD: `2203125 refactor(employee-import): validate employee import RPC object boundaries`.
- Ultimos commits relevantes:
  - `2203125 refactor(employee-import): validate employee import RPC object boundaries`
  - `7aaa705 feat(database): add typed employee import apply batch RPC`
  - `5f3870e refactor(repository): validate executive summary payload and wire customer performance v2`
  - `e09c1cb feat(db): harden dashboard performance RPC contract with typed returns`

## Metric Layer SQL (novo epic: Database Contract Hardening)

- View: `vw_customer_dashboard_metrics` com `security_invoker = true`, select explicitamente concedido para `authenticated`.
- RPC `get_executive_dashboard_summary()`: mantida como JSON (justificado como hierarquico); validacao runtime adicionada em `src/lib/repositories/types.ts` via `validateDashboardMetricResult`.
- RPC `get_dashboard_performance_by_customer`: substituida por `get_dashboard_performance_by_customer_v2` (RETURNS TABLE, `language sql`, SECURITY INVOKER, `search_path = public`); repositório atualizado para consumir v2.
- RPC `apply_employee_import_batch_v2`: nova migration `20260729241000` criada e aplicada no Supabase; repositório `service.ts` atualizado para consumir a versao tipada.
- RPCs `apply_employee_import_salary_item`, `confirm_employee_import_headcount`, `get_employee_import_preview_data`: mantidas como JSON (mutacao single-row); validacao runtime adicionada via `validateRpcObject` em `src/server/employee-import/service.ts`.
- Migration count: 101 local = 101 remoto (alinhado).
- **Pendencia**: conectividade TLS ao Supabase estava instavel durante a sessao; `npm run db:migrations:check` nao pôde ser reexecutado. Última confirmação: 101 local = 101 remoto.
- Invocabilidade futura: `get_full_delivery_data` mantida como JSON (14 colecoes heterogeneas atomicas); proximo incremento deve adicionar validacao de contrato na fronteira do repositório.

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
- Captura de voz usa `MediaRecorder` no navegador e transcricao autenticada no
  backend, sem depender do servico nativo de reconhecimento de fala do Chrome.
- A integracao diferencia permissao bloqueada, microfone indisponivel, formato
  invalido, falha de transcricao e indisponibilidade do servico.
- Nenhuma conversa, contexto de voz ou resultado externo e persistido no banco.

## Dashboard - contrato do RPC de performance

- O repositorio converte explicitamente o payload `snake_case` do RPC
  `get_dashboard_performance_by_customer` para o modelo `camelCase` da aplicacao.
- Numeros serializados como texto sao normalizados antes de chegar aos
  componentes, evitando falhas de renderizacao como chamada de `toFixed` em
  valor indefinido.

## Importacao administrativa de funcionarios

- A rota `/importacao-funcionarios` permite que administradores com acesso a
  remuneracao comparem uma planilha `.xlsx` antes de qualquer gravacao.
- O matching de pessoa usa nome normalizado exato. Ausentes, ambiguos e salarios
  invalidos nao alteram o cadastro nem removem valores existentes.
- O parser consolida todas as abas que contenham Nome, Salario e Gestor. A
  planilha de referencia resulta em 1.108 pessoas (Time Hunter + Time Operacoes),
  sem filtro por cargo, perfil ou area.
- A conciliacao e o combo consultam todas as pessoas canonicas de `people`.
- A coluna Gestor gera contagem por nome de origem. Nomes nao reconhecidos
  exigem de-para com uma pessoa cadastrada no sistema.
- De-paras ficam em `employee_import_manager_mappings`; salarios continuam em
  `person_compensations`; as novas acoes usam RPCs transacionais separadas.
- A migration `20260728223000_employee_import_batches_and_headcount.sql` foi
  aplicada no Supabase: arquivos ficam no bucket privado `employee-imports`,
  lotes/snapshots em `employee_import_batches` e estados por salario em
  `employee_import_salary_items`.
- O combo de de-para usa todas as pessoas canonicas, sem filtro por cargo ou
  `is_manager`.
- Atualizacao salarial e uma acao explicita por linha; o status persistido muda
  para `updated` somente depois do sucesso da RPC.
- A confirmacao de HC salva de-paras e atualiza o HC direto importado em
  `people`, com data, arquivo de origem e lote. O cadastro de Pessoas exibe esse
  valor como campo somente leitura.
- O arquivo bruto nao e persistido.

## Microfone da Analise de Desafio

- A causa raiz do bloqueio mesmo com permissao do Chrome era o header
  `Permissions-Policy: microphone=()`.
- O header passa a permitir microfone apenas para a propria origem com
  `microphone=(self)`; demais dispositivos/capacidades sensiveis continuam
  bloqueados.
