# Decisions

Gerado em: 2026-07-28 14:30:00 -03:00

## Decisoes confirmadas

1. `DeliveryRepository` permanece a fronteira principal da aplicacao para persistencia.
   - Fontes: `src/lib/repositories/types.ts`, `src/lib/repositories/provider.ts`.

2. Supabase/Postgres e o backend atual; migracao futura para SQL Server nao deve exigir reescrita da UI.
   - Fontes: contrato de repositorio e documentacao historica em `docs/anti-lock-in-migration-plan.md`.

3. Producao nao pode cair em mock/local fallback.
   - Fonte: `src/lib/repositories/provider.ts`.

4. `src/lib/roles.ts` e a fonte canonica TypeScript para papeis.
   - Fontes: `src/lib/roles.ts`, consumidores atuais de `RoleType`.

5. `OrganizationChart` e oficial; `OrganizationChartV2` nao deve ser reintroduzido.
   - Fontes: inventario atual de `src/components/organization/` e historico de handoff.

6. Studios sao aberturas contidas nas metas de Hunter ou Renovacao/Ampliacao.
   - Fontes: `src/lib/customer-target-total.ts`, `src/lib/reports/person-target-official-export.ts`, `src/lib/customers/customer-coverage-view-model.ts`.

7. New Logo fica no controle operacional, mas pode ser excluido da meta oficial planejada.
   - Fontes: `src/lib/domain/customer-target-scope.ts`, migration `20260716170000_customer_target_counts_toward_target.sql`.

8. Mutacoes criticas devem passar por BFF/RPC/repository com RLS preservado.
   - Fontes: `src/app/api/delivery/customers/route.ts`, `src/app/api/delivery/person-customer-targets/route.ts`, migrations de RLS.

9. Auditoria de acesso e metas por pessoa existe no banco.
   - Fontes: migrations `20260728113530_add_app_access_domain_audit.sql`, `20260728120500_add_person_target_domain_audit.sql`.

10. Telemetria estruturada deve ser usada para operacoes server-side observaveis.
    - Fonte: `src/server/observability/telemetry.ts`.

11. `vw_customer_dashboard_metrics` e a unica viewSQL reutilizavel para metricas de dashboard.
    - Evita duplicidade de JOINs e centraliza relacoes entre baseline, metas operacionais,
      alocacoes por pessoa e alocacoes por area/studio.
    - Fonte: migration `20260728140000_dashboard_customer_metric_view.sql`.

12. `get_executive_dashboard_summary()` e o RPC canonico para agregados de dashboard.
    - Usa a view acima como fonte de verdade, mantendo SECURITY INVOKER e RLS compativel.
    - Fonte: migration `20260728140500_dashboard_executive_summary_rpc.sql`.

13. `board_target_baselines`, `customer_target_years` e `revenue_target_allocations` nao sao valores independentes.
    - `board_target_baselines.total_target` = `customer_target_years.revenue` = soma de `revenue_target_allocations`
      (Hunter + Renovacao/Ampliacao, com studio contido).
    - `studio_target_allocations` e a quebra da `customer_target_years.studio_target`.
    - Nenhuma soma pode incluir studio novamente no total oficial.

14. Nao ha fonte autoritativa de "receita atual" no banco.
    - O banco armazena apenas metas; "receita atual" atual em mock (`src/data/customerPortfolioData.ts`).
    - O dashboard atual mapeia `revenueCurrent` para `allocatedPeopleTotal` (alocacao de meta).

15. Indices no metric layer so sao criados apos evidencia de plano de execucao.
    - Nenhum indice extra foi adicionado preventivamente.

16. O historico da conversa da Analise de Desafio e efemero e isolado por visao/ano.
    - O frontend envia apenas as seis interacoes mais recentes para a rota
      backend; nenhum texto da conversa e persistido no banco.
    - Pesquisa web depende de escolha explicita do usuario ou pedido textual
      reconhecido, e seu estado deve aparecer na resposta.
    - Fallback deterministico preserva o texto para nova tentativa e nunca e
      rotulado como pesquisa externa bem-sucedida.

17. Audio da Analise de Desafio e capturado no navegador e transcrito no backend.
    - O frontend usa `MediaRecorder` e envia o blob para uma rota interna
      autenticada; a chave e a chamada ao provedor de IA permanecem no servidor.
    - O fluxo nao depende de `webkitSpeechRecognition`, cuja permissao do site
      nao garante disponibilidade do servico de reconhecimento do Chrome.

18. Respostas de RPC sao adaptadas na fronteira do repositorio.
    - `get_dashboard_performance_by_customer` retorna campos `snake_case`, que
      sao convertidos e normalizados antes de compor o modelo de dominio/UI.
    - Componentes nao devem conhecer o formato bruto do Postgres.

19. A planilha de funcionarios e uma proposta revisada, nao uma nova fonte de verdade.
    - Pessoas continuam em `people` e salarios mensais correntes em
      `person_compensations.annual_salary` (nome legado do campo).
    - Matching automatico de pessoa e somente por nome normalizado exato;
      ausencias e ambiguidades nunca criam ou atualizam registros.
    - O de-para de gestor e persistido separadamente em
      `employee_import_manager_mappings` e serve para consolidar contagem; nao
      altera `people.manager_id`.
    - Salarios e de-paras sao aplicados atomicamente pela RPC
      `apply_employee_salary_import`, com RLS e auditoria.

20. O microfone e permitido apenas na origem da aplicacao.
    - `Permissions-Policy` usa `microphone=(self)` para a captura da Analise de
      Desafio; camera, geolocalizacao, pagamentos e USB permanecem negados.

## Decisoes pendentes

- Definir formalmente o nome e significado de `PersonCompensation.annualSalary`, pois o calculo atual anualiza o valor multiplicando por 12.
- Definir se a telemetria deve ir apenas para logs Vercel ou tambem para um sink externo pesquisavel.
- Definir processo oficial de saneamento de dados legados duplicados.
- Definir ate onde a simulacao de perfil admin deve influenciar backend, hoje tratada como contexto de UI/admin.
- Confirmar com dados reais se o RPC `get_executive_dashboard_summary` reconcilia com os calculos locais antes de migrar os cards do dashboard.

## Politica de atualizacao

- Atualize este arquivo quando uma decisao arquitetural, regra financeira, regra de seguranca ou fronteira de persistencia mudar.
- Nao registre conclusoes especulativas como decisao; use `KNOWN_ISSUES.md` ou `NEXT_STEPS.md` quando ainda houver duvida.
