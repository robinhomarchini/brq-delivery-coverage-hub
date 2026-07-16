# Squad Memory - BRQ Delivery Coverage Hub

## Quality Patterns & Anti-Patterns (2026-07-14+)

### Established Patterns to Preserve

✅ **Adapter Pattern**: DeliveryRepository centraliza persistência, permite trocar Supabase por SQL Server no futuro sem alterar UI

✅ **BFF for Sensitive Operations**: `/api/delivery/customers`, `/api/delivery/person-customer-targets` validam session, papel, RLS servidor-side

✅ **RLS Enforcement**: `is_active_brq_user()`, `can_edit_delivery_data()`, `is_delivery_admin()` em todas tabelas públicas

✅ **Validation Cascade**: Zod em cliente → BFF → Banco (nunca confiar em uma camada)

✅ **Transactions for Consistency**: RPCs como `save_person_with_assignments`, `save_customer_with_managers` para multi-write atomicity

✅ **Normalized Data Model**: `person_customer_assignments` N:N, targets por pessoa/cliente/tipo/ano, baselines separados

✅ **View Models Extracted**: `customer-coverage-view-model.ts`, `person-target-rollups.ts`, `studio-baseline-report.ts` fora de componentes

✅ **Partial Store Sync**: `setCustomerTargets((current) => ...)` + `syncStudioDerivedTargetsFromStudioAllocations()` vs full `getAll()`

### Security Anti-Patterns to Block

❌ **Never**:

- Use `unsafe-inline` em `script-src` CSP
- Hardcode user emails, credentials, dados de teste em migrations
- Expor `SUPABASE_SERVICE_ROLE_KEY` em `.env.example`, `.env.production`, versionado
- Chamar Supabase direto do browser para operações sensíveis (sem BFF)
- Deixar `.env.local` sem `.gitignore`
- Deploy sem `npm run security:check` passando

### Performance Anti-Patterns to Block

❌ **Never**:

- `getAll()` sem paginação em tabelas >100 registros
- Componentes >500 linhas sem extração de view models
- Full re-render em Store Context sem memoização
- Lazy loading de componentes pesados sem `<Suspense>`
- Recharts com 10k+ pontos sem downsampling
- HTML-to-Image PDF com 10k+ linhas sem streaming

### Architecture Anti-Patterns to Block

❌ **Never**:

- Hardcode operational data (pessoas, clientes, managers, hunters, áreas, studios) em UI
- Duplicar business rules apenas em UI (deve estar em repo/API/RPC/RLS/constraints)
- Usar string queries em Supabase sem type-safe builder
- Manter soft state em localStorage sem validação de servidor
- Chamadas diretas a `client.auth` em componentes (usar `authService`)
- Sem soft delete (dados deletados ficam órfãos)

### Quality Gates Obrigatórias

✅ **Sempre executar antes de push**:

```bash
npm run lint              # ESLint
npm run typecheck         # TypeScript strict
npm run test:contracts    # Repository contract
npm run security:check    # CSP, secrets, RLS
npm run build             # Next.js build
npm run smoke:critical    # Fluxos críticos
```

✅ **Antes de deploy para produção**:

```bash
npm run db:migrations:check  # Valida RLS/migrations
npm run test:performance     # Memoização, índices
npm run security:pentest-lite # Pentest contra URL
npm run smoke:rls            # RLS com perfis reais
```

### Incident Lessons (2026-07-14 Assessment)

1. **CSP unsafe-inline XSS**: Não publicar CSP nonce sem smoke real de navegador; Next 16 estático não adicionou nonce nos scripts renderizados e isso derrubou a hidratação em produção.
2. **Hardcoded test data**: Bloqueado por `grep` em security:check
3. **SERVICE_ROLE_KEY leak**: Documentado com SECURITY WARNING, nunca em .env.example
4. **Missing BFF**: Completar para `savePerson`, `saveArea`, `saveSubject`
5. **Manual deploy**: GitHub Actions CI/CD em progresso
6. **No rate limiting**: Implementar em `/api/delivery/*`
7. **No pagination**: Adicionar `limit`, `offset` ao `getAll()`
8. **Untested RLS**: `npm run smoke:rls` agora bloqueia regressões

## Current Task Objective

Centralizar importação de baselines em uma nova rota, removendo uploads antigos de Insights/Comparativo Baseline e preservando telas operacionais atuais.

## Execution Checklist

- [x] Criar rota Baselines para concentrar importação da Curva principal e baselines por área/studio.
- [x] Remover importador antigo de Insights, mantendo link para a central.
- [x] Transformar Comparativo Baseline em consumidor read-only das fotos salvas de Studios por origem/ano.
- [x] Adicionar metadados `source_code` e `source_name` aos snapshots de Studio com migration idempotente.
- [x] Aplicar migration `20260713112000_centralize_baseline_snapshot_sources.sql` no Supabase remoto.
- [x] Ajustar parser de Studio para fontes com layouts declarados por origem e layout largo Cliente + Renovação/Manut + Novos Projetos/Hunter.
- [x] Ignorar linhas visuais de Grupo em planilhas de origem de Studio/Área.
- [x] Criar `npm run test:baselines` para bloquear retorno de importação fora da central.
- [x] Criar roteador local `.ai/router` para classificar tarefas, selecionar contexto enxuto e preservar escalonamento para Codex.
- [x] Adicionar memória estável em `.ai/memory` sem segredos nem histórico temporário.
- [x] Adicionar prompts locais, README, tasks VS Code e scripts `ai:route`, `ai:context`, `test:ai-router`.
- [x] Garantir fallback determinístico quando Ollama/local model estiver indisponível.
- [x] Bloquear regressões com testes de override crítico, fallback local, limite de arquivos, path Supabase/migration, UNKNOWN escalation e não persistência de segredos.
- [x] Corrigir Metas por Pessoa para incorporar Studio Manutenção quando `maintenancePersonId` estiver explicitamente declarado, mesmo que o papel cadastral da pessoa ainda esteja desatualizado.
- [x] Corrigir Clientes para não marcar "Acima da meta" quando a Renovação/Ampliação vem de Studio Manutenção elegível herdado por pessoa.
- [x] Ajustar Relatório de Metas/Planilha oficial para não jogar Studio Manutenção explicitamente atribuído no bloco final de Studios.
- [x] Atualizar QA de relatório para bloquear regressão de responsável explícito em Studio Manutenção.
- [x] Rodar typecheck, test:reports, test:performance, lint, smoke crítico, test:security e build.
- [x] Ler contexto enxuto, memoria, contrato de squad e specs relevantes.
- [x] Decidir fonte de verdade: `own_amount` editavel e `amount` derivado/cache de Meta Hunter atual.
- [x] Criar migration com backfill inicial `own_amount = amount - Studio Hunter`.
- [x] Ajustar Metas por Pessoa para editar Meta propria e exibir Studio contido + Meta Hunter atual.
- [x] Ajustar repositorios local/Supabase para recalcular total ao salvar Meta propria ou Studio Hunter.
- [x] Ajustar Análise de Desafio para nao duplicar Studio Hunter quando ja houver Meta Hunter atual.
- [x] Atualizar specs e regras de negocio.
- [x] Aplicar migration e rodar lint/typecheck/build/smoke.
- [x] Remover exportacao duplicada do PageHeader quando a visao ativa e Baseline de Studios.
- [x] Consolidar filtros, cards de totais e inclusao de cliente em um painel unico sticky em Metas por Pessoa.
- [x] Rodar typecheck, lint, build e smoke critico apos ajustes de UX.
- [x] Modelar Hunter Especializado como papel de Pessoa, nao como novo fato financeiro.
- [x] Impedir Hunter Especializado de aparecer como pessoa lancavel em Metas por Pessoa.
- [x] Permitir Hunter Especializado como Hunter responsavel no cadastro de Cliente; somente nesse fluxo ele funciona como Hunter comum para criar vinculo pessoa-cliente e meta Hunter direta do cliente.
- [x] Permitir Hunter Especializado como Hunter associado em Metas por Area/Studio; nesse fluxo ele funciona como Studio Hunter e a meta Hunter derivada e permitida pelo banco somente se houver alocacao de Studio correspondente.
- [x] Criar relatorio derivado por Hunter Especializado + Cliente + Studio, usando `studio_target_allocations`.
- [x] Criar migration para permitir o novo role e bloquear meta direta no banco.
- [x] Aplicar migration no Supabase, rodar lint/typecheck/build/smoke e publicar producao.
- [x] Ampliar sugestoes do campo Cargo em Pessoas sem alterar `RoleType` nem regras financeiras.
- [x] Hidratar a visão Baseline de Studios com o snapshot mais recente do ano quando nao houver planilha importada na sessao.
- [x] Ao trocar Área/Studio em uma alocacao existente, perguntar se a meta existente deve ser movida ou se a edicao deve virar nova meta.
- [x] Sugerir o Hunter associado ao cliente ou com Meta Hunter no ano ao abrir nova meta por Area/Studio.
- [x] Preservar Valor Hunter, Valor Manutencao/Renovacao e Observacoes ao trocar apenas o Hunter durante edicao, carregando linha existente somente quando a combinacao ja existir.
- [x] Remover bloqueio de Hunter obrigatorio em Metas por Area/Studio e documentar que Hunter vazio fica como Studio Hunter a detalhar.
- [x] Separar Meta propria e Meta herdada de Studios na visao/detalhe/export de Hunters.
- [x] Mostrar Hunter Especializado em Metas por Pessoa somente como consulta derivada dos Studios do cliente, com Renovacao e acoes diretas inibidas.
- [x] Fazer Metas por Pessoa incluir clientes vindos de `studio_target_allocations` quando a pessoa e Hunter associada ao Studio.
- [x] Fazer Clientes considerar Studio Hunter por pessoa na lista de Hunters alocados e na distribuicao por pessoa, usando max(Meta Hunter direta, Studio Hunter) para nao duplicar.
- [x] Rodar typecheck, lint, smoke critico e build apos a correcao SICREDI/Gabriela.
- [x] Atualizar `AGENTS.md` com o modo lean enterprise engineering e novo formato final.
- [x] Atualizar `.squad/config.yaml` com ladder enxuto, regras de producao/Supabase e contrato de handoff.
- [x] Atualizar `C:\Users\rmarchini\.codex\AGENTS.md` para aplicar o modo lean enterprise engineering globalmente.
- [x] Reduzir duplicacao no `AGENTS.md` local, deixando o projeto herdar o padrao global.
- [x] Modelar meta gerencial de Hunter Especializado como relacao `specialist_hunter_studio_assignments`, sem criar meta oficial em `revenue_target_allocations`.
- [x] Criar migration/RPC transacional para salvar selecao por Hunter Especializado + Cliente + Ano.
- [x] Expor a selecao no contrato de repositorio, Supabase, fallback local e store.
- [x] Criar rota/tela Metas Hunter Especializado com filtros, checkboxes e totalizador.
- [x] Ajustar Relatorio de Metas para usar somente as linhas selecionadas de Hunter Especializado.
- [x] Rodar db:migrations:check, typecheck, lint, smoke critico e build.
- [x] Ao selecionar Hunter Especializado em Metas por Pessoa, orientar abertura da tela dedicada com pessoa/ano no contexto.
- [x] Redesenhar Metas Hunter Especializado com bloco Nova inclusao e bloco Selecoes cadastradas, incluindo pre-visualizacao de linhas ainda nao salvas.
- [x] Rodar typecheck, lint, smoke critico e build apos o ajuste de UX.
- [x] Ajustar Clientes para abater Studio Manutencao da pendencia de Renovacao na distribuicao por pessoa.
- [x] Atualizar specs para explicitar que Studio Manutencao concilia em Areas/Studios, nao em Metas por Pessoa.
- [x] Rodar typecheck, lint, smoke critico e build apos correcao de Clientes.
- [x] Fazer Metas por Pessoa mostrar cliente quando a pessoa esta em `hunterPersonId` de Studio com qualquer valor Hunter ou Manutencao.
- [x] Fazer Clientes mostrar a pessoa associada no Hunter do Studio mesmo quando a linha tem apenas Manutencao/Renovacao, sem somar manutencao no total Hunter.
- [x] Rodar typecheck, lint, smoke critico e build apos correcao BMG/Gabriela.
- [x] Fazer Metas por Pessoa somar Studio Hunter pelo Hunter efetivo quando `hunterPersonId` esta vazio e o Hunter principal vem da tela Clientes.
- [x] Fazer Metas por Area/Studio exibir, filtrar e ordenar pelo Hunter efetivo.
- [x] Rodar typecheck, lint, smoke critico e build apos correcao de Hunter efetivo.
- [x] Fazer Relatório de Metas usar Hunter efetivo em Pessoas, Hunters, detalhes e exportações.
- [x] Documentar criterio de aceite para que clientes como SICOOB/SICREDI nao sumam por `hunterPersonId` vazio.
- [x] Criar visão Hunter x Clientes com seletor unico de Hunter e linhas por Cliente + Area/Studio.
- [x] Incluir Meta propria Hunter e alocacoes de Studio Hunter/Manutencao usando Hunter efetivo.
- [x] Documentar que Manutencao aparece para leitura operacional e nao vira meta Hunter.
- [x] Criar agentes locais `ux-quality-reviewer`, `reuse-componentization-reviewer` e `database-performance-reviewer`.
- [x] Atualizar `.codex/project.json`, `.codex/README.md`, `AGENTS.md` e `.squad/config.yaml` com o novo fluxo de revisao.
- [x] Aplicar o mesmo padrao global em `C:\Users\rmarchini\.codex` para valer para todos os projetos.
- [x] Ajustar Hunter x Clientes para somar Renovacao + Ampliacao de pessoas nos clientes do Hunter.
- [x] Manter Manutencao/Renovacao como coluna operacional, sem alterar Meta Hunter.
- [x] Regularizar a Planilha oficial do Relatorio de Metas para 9 colunas: BU/Area Executivo, Executivo, Grupo Cliente, Cliente Faturamento, BU, Meta 2026, Renovacao (FARMER), Novo (HUNTER) e % Novo.
- [x] Manter a Planilha oficial no padrao completo do app, com subtotais/totais, usando as colunas Financial passadas pelo usuario.
- [x] Corrigir a visao Hunter x Clientes para tambem expor a Planilha oficial com a coluna Cliente Faturamento.
- [x] Criar `npm run test:reports` para o QA bloquear regressao nas colunas oficiais e no botao Planilha oficial por visao.
- [x] Evoluir `npm run test:reports` para gerar e abrir o XLSX oficial real, validando aba `Resumo_Cliente`, dimensao `A1:I4`, filtro `A3:I4`, cabecalhos e formulas.
- [x] Corrigir `Planilha oficial` para usar `officialLayout: true` e gerar workbook no layout Financial de 9 colunas, em vez do Excel padrao de 6 colunas.
- [x] Corrigir a composicao da Planilha oficial para incluir linhas proprias de Areas/Studios a partir de `studio_target_allocations`.
- [x] Fazer `npm run test:reports` validar tambem uma linha Studio no XLSX oficial gerado em memoria.
- [x] Corrigir `Cliente Faturamento` para receber o Studio nas linhas de Studio e `BU` para `Financial` no corpo da Planilha oficial.
- [x] Atualizar specs da Planilha oficial para refletir o novo padrao Financial.
- [x] Criar `docs/database-portability-plan.md` orientado a migracao futura para Microsoft SQL Server.
- [x] Criar `docs/persistence-contract.md` com contrato provider-neutral e equivalentes SQL Server.
- [x] Criar `docs/agent-evolution-backlog.md` com review e backlog das evolucoes recentes dos agentes.
- [x] Rodar typecheck, lint, build e diff --check apos os ajustes.
- [x] Criar harness inicial de testes de contrato do `DeliveryRepository` com runner `npm run test:contracts`.
- [x] Cobrir `getAll`, `savePersonCustomerTargets` e `saveStudioTargetAllocation` contra uma instancia limpa do adapter local.
- [x] Criar `src/lib/repositories/provider.ts` para centralizar a selecao `supabase`, `local-dev` e `unavailable`.
- [x] Refatorar `DeliveryStoreProvider` para consumir a factory de provider sem importar Supabase/local diretamente.
- [x] Criar `npm run test:provider` para bloquear regressao de acoplamento da store ao provider.
- [x] Publicar em producao a correcao da Planilha oficial Financial e os contratos/abstracao de provider no deployment Vercel `dpl_FLLgD3hAHfWuQCQRS2NrAXj3hn4g`.
- [x] Publicar subtotal em negrito na Planilha oficial Financial no deployment Vercel `dpl_4YdGJaPAMLhzmMkxRp4b9kL5zwVe`.
- [x] Rodar auditorias paralelas de arquitetura, seguranca/RLS/Auth e performance usando os agentes/skills do projeto.
- [x] Criar `applyDeliveryData` na store para centralizar hidratacao do grafo de persistencia e reduzir risco de estado parcial.
- [x] Proteger `/api/challenge-analysis` com autorizacao server-side Supabase + app access + regra admin/VP antes de processar dados de remuneracao.
- [x] Criar `npm run test:security` para bloquear regressao de rota sensivel sem auth server-side, mock em producao e formula injection em export.
- [x] Publicar hardening de seguranca da rota de IA e otimizacao da store no deployment Vercel `dpl_Fsecc1AsfsgkPWPASPBhvdithT7J`.
- [x] Criar e aplicar migration `20260709102000_harden_rls_audit_for_financial_targets.sql` para remover policies amplas antigas, restringir writes a editor/admin, restringir reads a usuários BRQ ativos e adicionar audit triggers em compensação, studios, Hunter Especializado e snapshots.
- [x] Confirmar histórico Supabase alinhado após a migration RLS com `npm run db:migrations:check`.
- [x] Criar `npm run smoke:rls` para validar perfis viewer/editor/admin/blocked com usuários dedicados de teste, sem writes persistentes.
- [x] Criar `npm run security:pentest-lite` para validar headers, bloqueio sem auth em `/api/challenge-analysis` e ausência de vazamento de stack/segredos em respostas públicas.
- [x] Executar pentest-lite contra produção `https://brq-delivery-coverage-hub.vercel.app` com sucesso.
- [x] Rodar `npm audit --json`, identificar vulnerabilidade moderada transitiva `next -> postcss` e mitigar com `overrides.postcss = "$postcss"`, deixando `npm audit` com 0 vulnerabilidades.
- [x] Publicar a mitigação de supply chain e os scripts de pentest/smoke no deployment Vercel `dpl_8ZE8g3DSAxjTBeenkPasemQgz4qi`, aliasado em `https://brq-delivery-coverage-hub.vercel.app`.
- [x] Criar `scripts/env-loader.mjs` para scripts de segurança carregarem `.env.local`/`.env` sem dependência extra e sem commitar segredos.
- [x] Criar `npm run smoke:rls:provision` com service role local, confirmação explícita e bloqueio de e-mails que não sejam contas dedicadas de smoke/teste.
- [x] Melhorar `npm run smoke:rls` para informar se faltam variáveis base ou perfis de teste.
- [x] Criar `npm run security:check` como gate único de segurança: hardening estático, `npm audit`, smoke RLS e pentest-lite.
- [x] Documentar em `docs/SECURITY.md` o fluxo de validação automatizada, provisionamento de contas smoke e variáveis seguras.
- [x] Otimizar `TargetManagement` criando resumo anual por cliente para evitar recalcular alocações por linha/cliente em reconciliação e assistente.
- [x] Trocar buscas lineares de nomes de cliente/pessoa por mapas memoizados em filtro/render da Conciliação de Metas.
- [x] Criar `npm run test:performance` para bloquear regressão da otimização de view model.
- [x] Criar e aplicar migration `20260709113000_performance_indexes_for_target_reports.sql` com índices compostos para alocações, Studios e Hunter Especializado.
- [x] Corrigir `scripts/check-supabase-migration-history.mjs` para usar `npx --cache .npm-cache --yes supabase ...`, evitando cache global do npm.
- [x] Confirmar histórico Supabase alinhado após migration de performance: 72 local / 72 remoto.
- [x] Sincronizar no store as metas Hunter afetadas por `saveStudioTargetAllocation`/`deleteStudioTargetAllocation`, evitando `fetchAll` e impedindo estado stale após salvar Studio Hunter.
- [x] Atualizar `npm run test:performance` para bloquear regressão dessa sincronização parcial no store.
- [x] Limpar no store vínculos órfãos ao excluir pessoa: remuneração, metas, associação `hunterPersonId` de Studio Hunter e atribuições de Hunter Especializado.
- [x] Limpar no store vínculos órfãos ao excluir cliente: metas do cliente, assuntos, metas de pessoa, alocações de Studio e atribuições de Hunter Especializado ligadas às alocações removidas.
- [x] Usar o retorno canônico do repositório em `saveSubject`, preservando IDs/defaults normalizados pelo backend/provider.
- [x] Atualizar `npm run test:performance` para bloquear regressões de limpeza parcial do store e retorno canônico do provider.
- [x] Validar a evolução parcial do store com typecheck, lint, test:performance, test:contracts, test:provider, build, smoke:critical, security:check e diff --check.
- [x] Publicar a evolução de consistência parcial do store no deployment Vercel `dpl_2hcwPM9aNNDo96dLEu3idY3C4ifR`, aliasado em `https://brq-delivery-coverage-hub.vercel.app`.
- [x] Melhorar UX do exportador compartilhado: a Planilha oficial agora também fica disponível no rodapé da Prévia, sem obrigar o usuário a fechar o modal para baixar o modelo oficial.
- [x] Componentizar o botão de exportação customizada em `ReportExportActions`, centralizando a chamada de exportação oficial/customizada.
- [x] Memoizar totais de rodapé do Relatório de Metas e extrair helpers pequenos (`sumAmount`, `summarizeHunterClientRows`) para reduzir `reduce` duplicado no JSX.
- [x] Atualizar `npm run test:reports` e `npm run test:performance` para bloquear regressões de UX/componentização no exportador e nos totais de relatório.
- [x] Publicar a melhoria de UX/componentização no deployment Vercel `dpl_ESSAykK3TYCZAfdWQacCJ1mhF7VA`, aliasado em `https://brq-delivery-coverage-hub.vercel.app`.
- [x] Extrair geração/download de CSV/XLSX de `ReportExportActions` para `src/lib/report-export.ts`, deixando o componente apenas com UI, prévia e botões.
- [x] Encapsular Supabase Auth em `src/lib/auth/auth-service.ts` para preparar troca futura por SSO interno sem alterar telas.
- [x] Refatorar `AuthGate`, logout do `AppShell` e token da Análise de Desafio para usarem o auth service em vez de chamadas diretas a `client.auth`.
- [x] Atualizar QAs de reports e segurança para bloquear retorno de geração XLSX ao componente e chamadas diretas de Supabase Auth em UI.
- [x] Publicar a extração de report service e auth service no deployment Vercel `dpl_Ab36QkpgGJ2BfuvsxB8nSzjxDfWf`, aliasado em `https://brq-delivery-coverage-hub.vercel.app`.
- [x] Evoluir auth para provider selecionável com `AuthProvider`, `AuthenticatedUser`, `createAuthServiceSelection`, default `supabase` e reserva explícita `corporate-sso`.
- [x] Adicionar `NEXT_PUBLIC_AUTH_PROVIDER=supabase` em `.env.example` e documentar que credenciais não devem ir para código/frontend.
- [x] Bloquear `corporate-sso` pendente no `AuthGate` para evitar bypass caso o provider seja selecionado antes da integração real.
- [x] Publicar o provider selecionável de auth no deployment Vercel `dpl_AZofjL9ecDjJECPXdWwk3TYEvb8r`, aliasado em `https://brq-delivery-coverage-hub.vercel.app`.
- [x] Fazer a importação da Curva principal criar automaticamente a foto `Baseline geral de Studios` a partir da coluna Áreas/Studios da própria Curva.
- [x] Definir a extração detalhada da Curva para baseline de Studios: aba `Sheet1`, cliente na coluna D, coluna C como identificador auxiliar de parceria/aliança, Studio/Habilitador na L, Tipo Opp na O, Total RL 2026 na AH e filtro BU Financial na BR.
- [x] Corrigir a importação rápida da Curva para exigir a aba `Resumo RL 2026`, sem fallback silencioso para a primeira aba.
- [x] Corrigir a linha `Baseline Curva` de Studios para usar valor no grão Cliente + Studio, sem repetir o total de Studio do cliente em cada Studio.
- [x] Criar rotina operacional de limpeza de `studio_baseline_snapshots` com dry-run, retenção por ano/origem e confirmação explícita antes de apagar.
- [x] Corrigir a Curva de clientes para filtrar `BU Financial` na aba `Resumo RL 2026`, ignorando outras BUs, linhas zeradas e linha Total.
- [x] Fazer a central de Baselines abrir em `Curva principal` por padrão e preservar a última visão escolhida no navegador.
- [x] Compactar a comparação da Curva principal: remover `Resp. planilha` e mover divergência Hunter longa para ação `Detalhes`.
- [x] Criar snapshot persistido `target_baseline_snapshots` para a última Curva de clientes e hidratar automaticamente a visão `Curva principal`.

## Previous Completed Work

- [x] Ler `AGENTS.md`, `.squad/config.yaml`, `.squad/memory.md` e configuracoes essenciais.
- [x] Identificar riscos de contexto: `.next`, `node_modules`, `.npm-cache`, logs, binarios, specs longas e caches globais.
- [x] Checar Headroom antes de instalar; nao foi encontrada integracao confiavel Codex/Headroom.
- [x] Criar `.codexignore` com politica rigorosa de contexto LLM.
- [x] Criar `docs/context-strategy.md` para carregamento progressivo de contexto.
- [x] Criar resumos compactos de database, frontend, backend, API, regras de negocio e padroes de codigo.
- [x] Criar memoria compacta: `docs/project-memory.md`, `docs/decisions.md`, `docs/domain-model.md`, `docs/glossary.md`.
- [x] Atualizar `.gitignore` para artefatos/cache/logs que tambem poluem contexto.
- [x] Aplicar a politica global em `C:\Users\rmarchini\.codex` apos aprovacao de escrita fora do workspace.
- [x] Limpar historico/cache global seguro: `.codex\.tmp`, `.codex\tmp`, `.codex\generated_images`, `.codex\archived_sessions` e sessoes JSONL antigas.
- [x] Rodar verificacoes leves de diff/arquivos apos os ajustes.

- [x] Ler `AGENTS.md`, `.squad/config.yaml`, `.squad/memory.md` e specs relevantes.
- [x] Inspecionar `PersonTargetReport`, `PersonTargetAssignment` e `ReportExportActions`.
- [x] Ler a estrutura da planilha `FINANCIAL-Rateio Metas AEs.xlsx` sem alterar o original.
- [x] Criar saída `.xlsx` real para exportações e botão customizado "Planilha oficial".
- [x] Adicionar exportação oficial no grão Executivo + Cliente, com subtotais e total geral.
- [x] Permitir detalhar/exportar um único Studio na visão Áreas / Studios.
- [x] Garantir que Hunter selecionado exporta o detalhe explodido por cliente/segmento/studio.
- [x] Incluir nome da pessoa no arquivo quando a exportação tiver uma única pessoa.
- [x] Mostrar base esperada das contas em Metas por Pessoa.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm run build`.
- [x] Revisar diff final, publicar em produção e registrar evidências.
- [x] Substituir escolha única por checkbox em Hunters e Áreas/Studios no Relatório de Metas.
- [x] Exportar/pré-visualizar detalhe explodido para um ou vários Hunters/Studios selecionados.
- [x] Atualizar specs para refletir seleção múltipla por checkbox.
- [x] Estruturar resposta GEN AI com narrativa, números refletidos, hipóteses/conceitos, recomendações, perguntas e baseline.
- [x] Mostrar baseline conceitual GEN AI ativo na Análise de Desafio.
- [x] Garantir que baseline GEN AI não altera metas, salários, status ou faixas oficiais.
- [x] Corrigir compatibilidade da API GEN AI para payload sem ano vindo de bundle/cache anterior.
- [x] Enter no contexto aciona Reavaliar com GEN AI; Shift+Enter quebra linha.
- [x] Criar bucket operacional `director-other` / "Outros" para governança transitória de cliente.
- [x] Exibir "Outros" no cadastro/filtro/listagem/export de Clientes e leituras por diretor.
- [x] Excluir "Outros" da visão de Relatório de Metas por Diretoria Delivery.
- [x] Controlar os campos do modal de Metas por Área/Studio por estado de formulário.
- [x] Validar cliente, área, ano e Hunter obrigatório antes de persistir alocação de Studio Hunter.
- [x] Normalizar o cliente apenas quando a edição de Studio exigir atualização de subtotais do cliente.
- [x] Rodar lint, typecheck, build e smoke crítico.
- [x] Publicar em produção após validação.
- [x] Ajustar Clientes para reconciliar Hunter por `max(Meta Hunter direta, Studio Hunter detalhado)`, sem duplicar Studio Hunter.
- [x] Impedir que Studio Hunter acima da abertura informativa gere linha "Acima da meta" no detalhe de Área/Studio do Cliente.
- [x] Rodar lint, typecheck, build e smoke crítico para a regra de Clientes.
- [x] Publicar correção de Clientes em produção.
- [x] Carregar automaticamente a alocação existente ao escolher Cliente + Área/Studio + Hunter + Ano no modal.
- [x] Ordenar por Cliente as grades de conciliação e alocações em Metas por Área/Studio.
- [x] Remover a atualização automática de Cliente no submit de Metas por Área/Studio para impedir erro falso após salvar a alocação.
- [x] Aplicar máscara visual em Reais nos campos de valor de Metas por Área/Studio.
- [x] Ao clicar em Alocar na conciliação, abrir a primeira alocação existente do cliente/ano quando houver.
- [x] Rodar lint, typecheck, build e smoke crítico para Metas por Área/Studio.
- [x] Publicar correção final de Metas por Área/Studio em produção.
- [x] Adicionar favicon SVG da aplicação em `public/icon.svg` e metadados em `src/app/layout.tsx`.
- [x] Ajustar a troca de Hunter responsável em Clientes para preservar outros Hunters/Farmers associados ao mesmo cliente.
- [x] Criar migration operacional para vincular Santander diretamente a Ricardo Bonatti Costa sem apagar outros participantes.
- [x] Aplicar migration Santander no Supabase de produção.
- [x] Rodar lint, typecheck, build e smoke crítico após os ajustes Santander/favicon.
- [x] Publicar produção com favicon e regra de preservação de Hunters/Farmers.
- [x] Analisar a planilha `Visao_Agrupada_SU_Torre_Grupo_Studio_TipoOpp.xlsx` para especificar a tela de baseline de studios.
- [x] Criar leitor de `.xlsx` tolerante a `inlineStr` vazio para o layout de Studios.
- [x] Criar helper de comparação Baseline Studio vs Cadastro do Cliente vs Alocação por Área/Studio.
- [x] Adicionar seção de upload, KPIs, grade e exportação do batimento de Studios no Comparativo Baseline.
- [x] Rodar lint, typecheck, build e smoke crítico para o batimento de Studios.
- [x] Publicar em produção e inspecionar alias Vercel.
- [x] Reposicionar Baseline de Studios como visão/botão no início do Comparativo Baseline, sem exigir rolagem.
- [x] Redesenhar batimento de Studios como tela executiva por Cliente + Studio, com linhas Baseline e Hunters/Alocações.
- [x] Publicar melhoria visual do Comparativo Baseline em produção e inspecionar alias Vercel.
- [x] Ajustar regra de batimento para comparar planilha vs Hunters/Alocações, sem bater contra total de Studios do cadastro do cliente.
- [x] Criar tabela `studio_baseline_snapshots` e ação "Salvar foto do resultado" para persistir snapshot imutável.
- [x] Aplicar migration `20260706204500_studio_baseline_snapshots.sql`, validar e publicar em produção.

## Decisions Already Made

- A politica global de contexto vive em `C:\Users\rmarchini\.codex\CONTEXT_POLICY.md` e vale para todos os projetos, salvo regra local mais estrita.
- Nao foi instalada ferramenta Headroom porque nao foi encontrada integracao Codex confiavel/verificavel; a alternativa segura foi politica global + `.codexignore` local.
- Bancos SQLite ativos do Codex (`logs_2.sqlite`, `state_5.sqlite`, etc.) foram preservados para nao quebrar estado/autenticacao/sessoes.
- O modelo de squad virtual complementa SDD e os skills existentes; ele nao substitui `AGENTS.md`, `.codex/`, specs ou arquitetura atual.
- O orquestrador e o comportamento padrao do Codex atuarao como Tech Lead: entender pedido, inspecionar contexto, classificar camadas impactadas, montar checklist, revisar com lentes especializadas e consolidar evidencia.
- A memoria operacional fica em `.squad/memory.md`; o contrato tecnico fica em `.squad/config.yaml`.
- Decisoes arquiteturais relevantes devem ser registradas em ADRs sob `docs/adr/`.
- Para UI, problemas de KPI, alinhamento, overflow, scroll, responsividade, acessibilidade e estados vazios/erro sao bloqueios de UX para telas tocadas.
- Para dados financeiros/metas, a fonte canonica deve preservar ano, grao e relacionamento normalizado; Studio Hunter e Meta Hunter direta sao fatos distintos e podem compor visoes derivadas.
- Em mobile/iPhone, o documento principal nao deve ter scroll horizontal. Tabelas largas podem ter scroll horizontal apenas dentro do proprio card/tabela.
- Dashboard Executivo, Portfólio de Clientes, Relatório de Metas, Baseline vs Cadastro e Ajuda continuam sendo as telas simples permitidas no mobile; telas operacionais permanecem inibidas.
- O modelo oficial de exportação Financial usa aba `Resumo_Cliente` e colunas Executivo, Grupo Cliente, Meta 2026, Renovação (FARMER), Novo (HUNTER), % Novo.
- Para Hunter, Studio Hunter compõe "Novo (HUNTER)" na saída oficial. Na visão Pessoas, Studio Hunter deve aparecer logo abaixo da meta própria do Hunter efetivo no mesmo cliente; Studio Manutenção/Renovação com Farmer/Delivery elegível compõe Renovação/Farmer da pessoa, enquanto linhas sem responsável elegível ficam no fim da planilha por chave Studio/Cliente.
- Para Studio Manutenção/Renovação, `maintenancePersonId` é a declaração explícita do responsável e prevalece no rollup da pessoa, na tela Cliente e na Planilha oficial, mesmo que o papel cadastral da pessoa ainda esteja desalinhado. O fallback legado por `hunterPersonId` continua exigindo papel Farmer/Delivery elegível para evitar incorporar dado antigo por engano; PX segue a mesma regra dos demais Studios.
- No Relatório de Metas, Hunters e Áreas/Studios usam checkboxes para seleção de exportação. Sem seleção, exportam consolidado; com seleção, exportam detalhe explodido.
- Na Análise de Desafio, baseline GEN AI é contextual/conceitual por visão+ano na sessão da tela. Ele aprende hipóteses e conceitos informados e os compara contra números oficiais, sem persistir ou sobrescrever dados oficiais.
- A API `/api/challenge-analysis` aceita `year` opcional para tolerar frontend em cache; quando ausente, usa 2026.
- `director-other` representa o bucket "Outros" para clientes sem diretoria definida. Ele existe como pessoa operacional por causa da FK `customers.director_responsible_id -> people.id`, mas não deve consolidar metas por Diretoria Delivery.
- Metas por Área/Studio devem editar a linha exata no grão Cliente + Área/Studio + Hunter + Ano; o modal não deve depender de `defaultValue` quando aberto repetidas vezes.
- Na tela Clientes, Studio Hunter é detalhe contido em Hunter: quando há Meta Hunter direta e Studio Hunter detalhado no mesmo cliente/ano, a reconciliação usa o maior dos dois como cobertura Hunter, não a soma.
- Em Metas por Área/Studio, a operação principal é salvar `studio_target_allocations`. O submit não deve chamar `saveCustomer`; subtotais divergentes ficam visíveis na conciliação.
- Um cliente pode ter múltiplos Hunters/Hunter + Farmer associados. A troca do Hunter responsável no cadastro de Cliente não deve remover esses vínculos nem metas de outros participantes.
- Santander deve ter Ricardo Bonatti Costa como Hunter direto; Ricardo Bonfim é outra pessoa e não deve ser confundido com Bonatti.
- A tabela `person_customer_assignments` ainda não diferencia claramente "Hunter direto/principal" de participante Hunter/Farmer. A correção atual preserva participantes e adiciona o vínculo direto, mas a evolução ideal é modelar esse papel explicitamente.
- O batimento de baseline de Studios fica na rota Comparativo Baseline e é apenas comparativo: não grava nem sobrescreve cliente, pessoa ou alocações.
- A planilha de Studios usa `Tipo Opp` para classificar valores: Novo/Ampliação entra em Studio Hunter; demais tipos entram em Studio Manutenção/Renovação.
- No batimento de Studios, não se compara contra o total de Studios cadastrado no Cliente. Studio Hunter da planilha bate contra `studio_target_allocations.hunter_amount` atribuído a Hunters/pessoas com papel de Hunter. Studio Manutenção bate contra `studio_target_allocations.maintenance_amount` no Cliente + Studio.
- A prévia/exportação de Studios deve evitar colunas sequenciais para cada fonte. A leitura executiva usa Cliente + Studio como chave, linhas por visão e colunas Hunter, Manutenção, Total e Diferença. Divergência de origem/nome aparece só como indicativo contextual quando existir.
- "Salvar foto do resultado" grava um snapshot imutável em `studio_baseline_snapshots`, com ano, arquivo, totais e linhas calculadas, sem alterar metas ou alocações.
- A importação de baselines oficiais fica centralizada na rota Baselines. Insights não deve renderizar o importador antigo, e Comparativo Baseline não deve possuir upload/salvamento próprio de planilhas oficiais.
- `studio_baseline_snapshots` agora guarda `source_code` e `source_name` para separar fotos de PX, Alianças, Mobile, Analytics, GENAI e baseline geral.
- Cada origem de baseline de Studio/Área pode declarar layouts aceitos. A primeira implementação suporta layout detalhado de Studios e layout largo Cliente + Renovação/Manut + Novos Projetos/Hunter; linhas `Grupo ...` são ruído visual e não entram no domínio.
- Na central de Baselines, o batimento por Cliente + Studio/Origem deve exibir três origens distintas: `Baseline Studio` importada da planilha específica do Studio, `Cadastrado` em `studio_target_allocations` e `Baseline Curva` vinda da Curva principal no ano selecionado. Snapshots antigos com `Baseline`/`Alocado` continuam compatíveis.
- A origem `Baseline geral de Studios` gerada pela Curva principal continua sendo a foto da linha `Baseline Curva`; no Comparativo, a visão geral deve preferir consolidar as últimas fotos específicas por Studio/Área como `Baseline Studio` quando elas existirem.
- Na Curva principal, a curva de clientes vem da aba `Resumo RL 2026`; o baseline detalhado de Studios vem da aba `Sheet1`: `Grupo Cliente` coluna D como cliente, coluna C como identificador auxiliar de parceria/aliança, `Studio/Habilitador` coluna L, `Tipo Opp` coluna O para separar Novo/Ampliação como Studio Hunter e demais tipos como Manutenção/Renovação, `Total RL 2026` coluna AH, e somente `CC CROSS`/coluna BR igual a `BU Financial`. Buckets `Squad` e `Times` ficam fora para nao inflar o baseline de Studios com o bloco operacional principal; `RESELL` entra quando a coluna C, D ou J identifica aliança reconhecida, como `Google LLC`, `Microsoft`, `Amazon Web` ou `Datadog`/`Data Dog`, e fica fora se não houver mapeamento; `Arquitetura` vira PX somente quando coluna A/SU for `Weme`. Quando L for Cloud/CLOUD, coluna C, D ou J `Managed Services` vira `Managed Services`; se coluna C, D ou Revenue Stream J indicar `Google LLC`, `Microsoft`, `Amazon Web` ou `Datadog`/`Data Dog`, a linha vira `Alianças Google`, `Alianças Microsoft`, `Alianças AWS` ou `Datadog-Alianças`. Exemplo real: Votorantim + Cloud + Revenue Stream Google LLC + 700000 deve entrar em `Alianças Google`. A planilha `Visão Agrupada` vira conferência de teste de mesa, não função sistêmica nem origem obrigatória.
- A importação da Curva principal precisa mostrar progresso por etapa para diferenciar processamento ativo de travamento: baseline de clientes, parsing, Sheet1 de Studios, comparação, geração da foto e salvamento.
- Na importação manual de baseline de Studio/Área, se a planilha trouxer `BU` ou `CC CROSS`, linhas `BU Financial` vêm pré-marcadas; se a planilha não trouxer essa coluna, a prévia exibe checkbox por Cliente + Studio para marcar quais linhas são Financial. KPIs, exportação e snapshot salvo usam somente as linhas marcadas, evitando poluir a base com outras BUs e preservando calibração manual.
- A serialização/restauração de linhas de Baseline de Studios e a montagem das linhas de relatório ficam centralizadas em `src/lib/studio-baseline-report.ts`; telas não devem recriar localmente essa lógica.
- O grid de Baselines por Área/Studio deve usar `SortableTableHead` e consolidar duplicidades no grão Cliente + Studio/Origem antes de renderizar, totalizar ou exportar. Baseline importado pode somar linhas quebradas; Cadastrado e Baseline Curva são valores de referência da chave e não devem dobrar.
- O leitor leve de XLSX deve resolver abas nomeadas pelo workbook/relationship interno e falhar com mensagem clara quando `Resumo RL 2026` estiver ausente; nunca usar `Sheet1` como fallback para a Curva de clientes.
- A Curva de clientes da central de Baselines deve importar somente linhas `BU Financial` com total maior que zero na aba `Resumo RL 2026`; outras BUs e a linha Total não entram na comparação nem nos updates.
- Na comparação de Studios, `registeredCustomerStudioTarget` representa a Baseline Curva por Cliente + Studio/Habilitador. O total de Studio do cliente inteiro não deve ser repetido nas linhas individuais de Studio.
- Na comparação de Studios, nomes equivalentes de alianças devem bater por chave canônica, não por string exata. Ex.: `Alianças AWS`, `AWS-Alianças` e variações de separador representam o mesmo Studio cadastrado, mantendo o nome cadastrado na exibição.
- Ao restaurar fotos antigas de Baseline de Studios, a linha `Baseline Curva` deve recompor o total por Hunter + Manutencao quando o total salvo estiver inconsistente, evitando divergencia falsa entre visao geral e fontes manuais como Studio PX.
- Fotos salvas de Baseline de Studios preservam a origem baseline, mas `Cadastrado`, status e nomes cadastrados devem ser recalculados ao abrir contra `areas`, `customers` e `studio_target_allocations` atuais. Isso permite corrigir aliases/alocações sem reimportar snapshots antigos.
- Snapshots antigos de baseline devem ser limpos por `npm run maintenance:baseline-snapshots`, com `DRY-RUN` padrão e retenção mínima de 1 foto por ano/origem. Não apagar snapshots manualmente fora da rotina auditável.
- A central de Baselines deve preservar a última visão escolhida no navegador; sem preferência salva, abre em `Curva principal` para favorecer o fluxo oficial da Curva.
- A comparação da Curva principal deve manter linhas compactas: resumo de Hunter na célula e racional completo em modal de detalhes; não mostrar `Resp. planilha` quando a origem não traz responsável confiável.
- A Curva principal tem snapshot próprio em `target_baseline_snapshots`, separado do snapshot geral de Studios. A tela deve carregar a última foto de clientes por ano e salvar nova foto a cada importação.
- A revisão de componentização está documentada em `docs/COMPONENTIZATION_REVIEW.md`; próximos alvos seguros são builders puros de `person-target-report.tsx` e `customer-management.tsx`, antes de extrair componentes visuais.
- A geração da Planilha oficial do Relatório de Metas fica centralizada em `src/lib/reports/person-target-official-export.ts`. `person-target-report.tsx` apenas reexporta `buildOfficialRowsForView` para compatibilidade com o gate `test:reports`.
- Rollups comuns do Relatório de Metas ficam em `src/lib/reports/person-target-rollups.ts`: Studio Hunter efetivo, renovação de Studio elegível por pessoa, meta própria descontando herança e fallback de Hunter principal. Não duplicar esses cálculos em tela/export.
- A view model de cobertura/conciliação da tela Clientes fica centralizada em `src/lib/customers/customer-coverage-view-model.ts`. `customer-management.tsx` não deve reintroduzir cálculos inline de status, composição por pessoa, composição por área/studio ou ordenação de cobertura; `npm run test:performance` bloqueia essa regressão.
- Na central de Baselines, a Curva principal compara e aplica somente Meta Hunter, Renovação/Ampliação e Meta Total do cliente. Áreas/Studios é subquebra contida e tem batimento exclusivo na visão detalhada de Baseline de Studios; a grade principal não deve marcar cliente como divergente nem sobrescrever `studioTarget` por diferença de Studio.
- Na importação da Curva principal, Hunter/responsável da planilha é informativo. Diferença entre essa composição e o sistema não gera divergência, alerta ou bloqueio se os valores financeiros do cliente estiverem batidos.
- Na importação da Curva principal, `Total RL 2026` é exibido e validado contra Hunter + Renovação, mas não cria divergência separada porque a Meta Total é derivada desses dois componentes. Divergência aplicável vem de Meta Hunter ou Renovação/Ampliação.
- Grades operacionais e de batimento devem usar `SortableTableHead` nos cabeçalhos ordenáveis. Tabelas novas ou alteradas não devem voltar para cabeçalhos estáticos quando exibem listas comparáveis/filtráveis.
- Na tela Clientes, Studio Hunter e Studio Manutenção/Renovação exibidos no formulário são derivados de `studio_target_allocations` e somente leitura; ajustes devem ocorrer em Metas por Área/Studio. Diferenças residuais que formatam como R$ 0 não devem gerar alerta visual de distribuição.
- No Relatório de Metas, a visão `Pessoas x Clientes` é o detalhe operacional no grão Pessoa + Cliente. Ela combina vínculos cadastrais, responsáveis Delivery/Farmer, metas próprias e heranças de Studio Hunter/Studio Manutenção, sem criar fonte de verdade nova.
- No Comparativo Baseline, `Baseline geral de Studios` consolida as últimas fotos específicas por Studio/Área quando elas existem. A foto `studio_general` gerada pela Curva principal alimenta a linha `Baseline Curva`; ela não deve sobrescrever a linha `Baseline Studio` de uma origem específica como PX para a mesma chave Cliente + Studio.

## Next Pending Step

Próximo passo: mover a view model de Clientes do Relatório de Metas (`buildClientCoverageRows` e colunas/totalizadores relacionados) para `src/lib/reports/`, reutilizando `person-target-rollups.ts` e mantendo `npm run test:reports` como gate obrigatório.

## Discovered Commands

- `npm run dev`: servidor local Next.js.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript sem emit.
- `npm run build`: build de producao Next.js.
- `npm run test:provider`: checagem estatica da factory de provider e desacoplamento da store.
- `npm run test:baselines`: checagem estatica de centralizacao de importacao de baselines e origem por snapshot.
- `npm run test:reports`: checagem estatica das colunas e dos botoes de exportacao oficial do Relatorio de Metas.
- `npm run test:currency-input`: checagem de parsing/formatacao de inputs monetarios pt-BR usados em cadastro de metas.
- `npm run test:security`: checagem estatica de hardening para rota de IA sensivel, mock em producao e formula injection em export.
- `npm run test:performance`: checagem estatica de hardening de performance em view models e índices de banco.
- `npm run smoke:rls`: smoke opcional de RLS/RBAC com usuários dedicados de teste.
- `npm run smoke:rls:provision`: provisiona contas dedicadas de smoke RLS usando service role local e confirmação explícita.
- `npm run security:check`: gate agregado de segurança com hardening estático, audit, smoke RLS e pentest-lite.
- `npm run security:pentest-lite`: pentest leve e seguro contra URL publicada ou `PENTEST_BASE_URL`.
- `npm audit --json`: auditoria de vulnerabilidades conhecidas em dependências npm.
- `npm run smoke:critical`: smoke critico para fluxos de cliente/pessoa/metas.
- `npm run db:migrations:check`: checagem de historico de migrations Supabase.
- `npm run audit:background`: auditoria de processos em background via PowerShell.
- `npx --cache .npm-cache --yes supabase <command> --linked`: caminho aprovado para Supabase CLI neste repo.
- `npx --cache .npm-cache --yes supabase db push --linked`: aplica migrations pendentes no Supabase remoto depois de `migration list`.
- `npx vercel deploy --prod`: deploy de producao Vercel.
- `npx --cache .npm-cache --yes vercel deploy --prod --yes --force --archive tgz`: caminho preferido para deploy direto no Windows quando o upload normal do Vercel CLI fica preso; usar cache local e pacote `tgz` para evitar cache global/artefatos/symlinks.
- `npm install fflate`: declara o leitor ZIP usado pelo parser de `.xlsx` de Studios.

## Ports, Paths, Environment Variables and Project Conventions

- Raiz canonica: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- Nao editar o stub OneDrive: `C:\Users\rmarchini\OneDrive - BRQ\Documentos\OrgBRQDelivery`.
- App local padrao: `http://localhost:3000`.
- Producao Vercel: `https://brq-delivery-coverage-hub.vercel.app`.
- Specs principais: `specs/delivery-coverage-hub/`.
- Repositorios de dados: `src/lib/repositories/`.
- Migrations Supabase: `supabase/migrations/`.
- Docs de arquitetura/producao/seguranca: `docs/`.
- ADRs: `docs/adr/`.
- Variaveis Supabase/OpenAI ficam em `.env.local`/Vercel; nunca expor secrets no frontend.
- Texto da UI: portugues do Brasil.
- Codigo, identificadores, componentes, funcoes e comentarios: ingles.
- Reusar componentes em `src/components/ui/` e compartilhados em `src/components/shared/`.

## Known Pitfalls and Constraints

- Worktree costuma estar suja; nao reverter alteracoes nao feitas pelo agente.
- Supabase CLI deve usar cache local `.npm-cache`; evitar `npx --no-install supabase`.
- Distinguir falhas de cache/rede/telemetria/autenticacao CLI de drift real de schema.
- `npm run db:migrations:check` roda `supabase migration list` via script e pode falhar no sandbox com `LegacyPlatformAuthRequiredError` mesmo quando o CLI escalado esta autenticado. Caminho correto: rerodar o mesmo `npm run db:migrations:check` com `sandbox_permissions: require_escalated`; nao trocar para SQL manual nem migration repair. Em 2026-07-10 as migrations `20260710103000_studio_maintenance_responsible_person.sql` e `20260710195500_allow_farmer_delivery_customer_responsibles.sql` aplicaram com `npx --cache .npm-cache --yes supabase db push --linked`, e o check escalado confirmou 74 local / 74 remoto.
- Nao hardcodar pessoas, clientes, managers, hunters, areas, studios ou owners em UI.
- Metas e fatos financeiros precisam de periodo/ano e grao explicito.
- Studio Hunter nao deve ser duplicado como meta direta da pessoa. `revenue_target_allocations.own_amount` guarda a Meta propria Hunter/Farmer editavel; `revenue_target_allocations.amount` guarda a Meta atual derivada como propria + Studio Hunter ou Studio Manutencao/Renovacao elegivel. Studio PX segue a mesma regra de incorporacao dos demais Studios.
- Arquivos `.xlsx` gerados pelo Excel podem conter células `inlineStr` vazias; `read-excel-file` falhou nesse layout específico, então a tela de baseline de Studios usa parser leve com `fflate` + `DOMParser`.
- Service role pode existir apenas em backend/BFF; usuarios finais continuam nominais.
- Salario/remuneracao e sensivel; exige controle UI + RLS/autorizacao.
- Telas executivas precisam de sinais visuais, tooltips de racional e KPIs sem overflow.
- Acoes de exportacao devem aparecer em um unico lugar por contexto/visao ativa; duplicar Preview/CSV/Excel no header e no card da mesma funcao e bloqueio de UX.
- Em telas operacionais de metas, filtros de contexto, totais e acoes de inclusao devem ficar agrupados no mesmo painel para reduzir zigue-zague visual.
- Hunter Especializado e um papel gerencial cross. Em regra, ele nao recebe lancamento direto em Metas por Pessoa; seu relatorio gerencial deriva das linhas selecionadas em `specialist_hunter_studio_assignments`, que apontam para `studio_target_allocations`. Excecoes autorizadas: quando selecionado como Hunter responsavel no cadastro de Cliente, funciona como Hunter comum apenas para aquele cliente, criando vinculo pessoa-cliente e meta Hunter direta via `allowSpecialistHunterAsCustomerHunter`; quando selecionado como Hunter associado em Metas por Area/Studio, funciona como Studio Hunter e a meta Hunter derivada e permitida se houver alocacao de Studio correspondente. Nao liberar edicao direta em Metas por Pessoa.
- Na tela Clientes, Studio Manutencao cobre a leitura de Renovacao/Manutencao para fins de pessoa e nao deve gerar linha "Abaixo da meta sem pessoa alocada"; eventuais diferencas ficam na conciliacao de Areas/Studios.
- Na tela Clientes, o seletor de responsaveis Farmer/Delivery deve usar pessoas ativas com perfil operacional elegivel (`Farmer + Delivery`, `Delivery`, `Farmer`, `Hunter + Farmer`) mesmo quando o legado `isManager` estiver desatualizado. A RPC `save_customer_with_managers_and_targets` continua exigindo `can_write_delivery_hardening()`.
- Na tela Metas por Area/Studio, quando a soma detalhada alocada supera a meta-base antiga do cliente, a conciliacao usa o detalhamento como alvo efetivo exibido para nao marcar "Acima" falso apos edicao da abertura.
- No Relatorio de Metas, a aba Clientes e uma visao derivada no grao Cliente + Ano. Ela consolida Hunters, Delivery/Farmers e Hunters Especializados a partir de `person_customer_assignments`/`people.clientIds`, `revenue_target_allocations`, `studio_target_allocations` e `specialist_hunter_studio_assignments`; tambem exibe meta total cadastrada do cliente, meta ligada e diferenca para conciliacao. A aba possui modo com valores/sem valores; Hunters com valor aparecem, e se nao houver nenhum Hunter com valor pode aparecer somente o Hunter principal zerado. Vínculos comerciais zerados adicionais nao devem aparecer na coluna comercial. Nao cria nova fonte de verdade nem migration.
- `studio_target_allocations.hunterPersonId` e uma associacao operacional relevante para visibilidade. Se a linha tiver valor Hunter ou Manutencao, a pessoa associada deve aparecer nas telas; apenas `hunterAmount` soma no total Hunter. Quando `hunterPersonId` estiver vazio, o Hunter efetivo e o Hunter principal do Cliente.
- Em mobile, fluxos operacionais complexos devem ficar inibidos/consulta simples conforme spec.
- Antes de deploy em fluxos de cliente/pessoa/meta, rodar `npm run smoke:critical`.
- A administracao de acesso deve passar por `AccessRepository` em `src/lib/repositories/accessRepository.ts`; telas nao devem criar cliente Supabase nem chamar RPCs de acesso diretamente.
- `saveCustomer` passa por `/api/delivery/customers`; a rota valida bearer token, app access e papel editor/admin, e executa o provider atual com o contexto RLS do usuario.
- `savePersonCustomerTargets` passa por `/api/delivery/person-customer-targets`; a rota valida bearer token, app access e papel editor/admin, e executa o provider atual com o contexto RLS do usuario.
- No Relatorio de Metas, a visao `Pessoas x Clientes` deve ser montada por pessoa selecionada em combo; nao usar busca livre como principal. Os totais Hunter/Renovacao sao valores atuais e os Studios aparecem como composicao contida, nao como soma adicional. Exibir "propria sem Studio" + "Studio contido" apenas como decomposicao do valor atual.
- Para telas e relatorios, a regra de composicao contida e unica: Meta propria exibida = Meta atual - Studio contido. `own_amount` e cache/editavel de persistencia e nao deve prevalecer em relatorio, exportacao ou status executivo quando divergir do valor atual menos Studio.
- Ao salvar alocacao de Studio, a sincronizacao derivada deve preservar a regra contida: se a Meta atual existente cobre o Studio, recalcular `own_amount = amount - Studio`; se o Studio for maior que a Meta atual, elevar o total apenas ao valor do Studio. Nunca somar Studio sobre `own_amount` stale como se fosse incremento automatico.
- Em 2026-07-15, push para GitHub falhou com 403 `You must verify your email address`; enquanto isso nao for resolvido, deploy por integracao Git/Vercel nao vai publicar novos commits. Deploy direto via Vercel CLI com `--archive tgz` conseguiu upload pequeno, mas alguns deployments ficaram `UNKNOWN` sem logs/build; inspecionar alias antes de considerar producao atualizada.
- Para deploy Vercel manual no Windows, sempre rodar `npm run deploy:check` antes de `npm run deploy:prod`. O check valida link do projeto, credencial e cache isolado gravavel. `deploy:prod` usa `scripts/vercel-prod-deploy.mjs`, que executa Vercel CLI via `npx --package node@22 --package vercel@56.2.0` e `LOCALAPPDATA=.vercel-cli/localappdata`, evitando Node 24 + cache global que gerou `The value of "err" is out of range`. Se nao houver `VERCEL_TOKEN` nem `%USERPROFILE%\.vercel\auth.json`, parar e regularizar login; nao repetir variacoes de `vercel deploy` sem credencial.
- Se antivirus bloquear `%USERPROFILE%\.vercel\auth.json`, usar `VERCEL_TOKEN` em `.env.local`. Os scripts `deploy:check` e `deploy:prod` carregam `.env.local` via `scripts/env-loader.mjs`; nunca commitar token nem colar o valor em resposta.
- Em 2026-07-15 foi corrigida regressao em que a tela/conciliacao de metas por cliente somava Studio Manutencao ao total alocado e alguns saves ainda persistiam `revenue` como Hunter + Renovacao + Studio. Regra vigente: `getCustomerTotalTarget` e a persistencia devem usar apenas Hunter + Renovacao; Studio Hunter e Studio Manutencao sao composicao contida. Nao usar `customer.revenue` como fonte para Meta Total em telas/exports quando Hunter/Farmer estiverem disponiveis.
- Ainda em 2026-07-15, a tela Metas por Pessoa foi corrigida para os inputs de Hunter e Renovacao representarem a Meta atual total da pessoa no cliente. Ao salvar, o payload grava `own_amount = total digitado - Studio contido`. Nao voltar a exibir/salvar o input como propria pura, porque isso soma Studio novamente no "Total atual".
- Para Hunter Especializado na tela Metas por Pessoa, a linha e somente consulta e deve herdar apenas as alocacoes de Studio selecionadas para a pessoa em `specialist_hunter_studio_assignments`, usando a parcela `hunterAmount`. Nao usar todos os Studios do cliente nem somar `maintenanceAmount`; isso dobra casos como Professional Services/Guedelha.

## Stable Facts About the Project

- Projeto: BRQ Delivery Coverage Hub.
- Tipo: aplicacao web executiva interna.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style primitives, Recharts.
- Banco: Supabase/Postgres com RLS, migrations em SQL.
- Persistencia: repositorios locais e Supabase adapter via contratos em `src/lib/repositories/`.
- Auth: Supabase Auth, usuarios BRQ nominais, dominio `@brq.com`, roles/perfis do app.
- Deploy: Vercel.
- Arquitetura: frontend Next.js com store client-side e repositorios; backend via rotas internas/API quando necessario.
- Quality gate padrao: lint, typecheck, build; smoke critico para persistencia de cliente/pessoa/meta; migrations check quando schema/RLS muda.
- SDD e obrigatorio para mudancas nao triviais; specs vivem em `specs/delivery-coverage-hub/`.
