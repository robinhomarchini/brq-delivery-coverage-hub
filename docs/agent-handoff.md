# Agent Handoff — BRQ Delivery Coverage Hub

Este arquivo e um artefato oficial de coordenacao entre Codex, Kilo, ChatGPT e outros agentes de engenharia. Atualize ao fim de cada sessao relevante, mantendo fatos verificaveis no repositorio e sem incluir segredos, logs transientes ou conclusoes especulativas.

## 1. Metadata

- Atualizado em: 2026-07-28 10:27:18 -03:00
- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`
- Raiz local: `C:\Users\rmarchini\projetos\OrgBRQDelivery`
- Branch: `main`
- HEAD antes desta sessao: `4546a30850a729f0986a1867472d32d05fd95129`
- Baseline de produto antes desta sessao: `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- Baseline de producao conhecida: `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- URL de producao conhecida: `https://brq-delivery-coverage-hub.vercel.app`
- Agente gerador: Codex
- Proximo agente previsto: Kilo, Codex ou ChatGPT

## 2. Git status verificado

- `git status --short` apos a extracao atual:
  - `M package.json`
  - `M src/components/customers/customer-management.tsx`
  - `M src/components/dashboard/executive-dashboard.tsx`
  - `M src/components/insights/baseline-comparison.tsx`
  - `M src/components/reports/person-target-report.tsx`
  - `M src/components/targets/person-target-assignment.tsx`
  - `M src/components/targets/specialist-hunter-target-assignment.tsx`
  - `M src/lib/customer-target-total.ts`
  - `M src/lib/customers/customer-coverage-view-model.ts`
  - `M docs/agent-handoff.md`
  - `?? scripts/verify-customer-target-scope.ts`
  - `?? src/lib/domain/`
- `git branch --show-current`: `main`
- `git rev-parse HEAD`: `4546a30850a729f0986a1867472d32d05fd95129`
- `git diff --stat`: diff pequeno de produto + handoff; sem migracoes/Supabase.
- `git diff`: revisado para a capacidade de escopo New Logo.
- `git diff --cached --stat`: sem staged changes
- `git diff --cached`: sem staged changes
- Arquivos untracked atuais: `scripts/verify-customer-target-scope.ts`

## 3. Objetivo atual

Backend Business Rules Consolidation: migrar uma capacidade deterministica para um contrato de dominio/backend-safe sem alterar comportamento.

## 4. Decisoes aprovadas

- `OrganizationChart` e a implementacao oficial do organograma.
- `OrganizationChartV2` nao deve ser reintroduzido.
- O organograma validado deve preservar `PersonCard` controlado pelo container, grid responsivo de reportes diretos, colunas flexiveis, conector pontilhado de Staff, expand/collapse acessivel e exportacao PNG completa.
- `src/lib/roles.ts` e a fonte canonica TypeScript para papeis de dominio.
- `src/data/mockData.ts` deve consumir `RoleType` de `src/lib/roles.ts`.
- Valores persistidos de papel devem permanecer: `Executive`, `Director`, `Farmer + Delivery`, `Delivery`, `Hunter`, `Hunter Especializado`, `Farmer`, `Hunter + Farmer`, `Staff`.
- `Manager` nao e `RoleType` persistido; pode ser apenas label visual, relacional, hierarquico ou de exportacao.
- Constraints Supabase de papel devem permanecer compativeis.
- Sobreposicoes semanticas entre papeis nao devem ser alteradas silenciosamente.

## 5. Fatos verificados no codigo

- `src/lib/roles.ts` exporta `ROLE_TYPES` como tuple readonly e deriva `RoleType` dele.
- `ROLE_DEFINITIONS` esta tipado como `Record<RoleType, RoleDefinition>`.
- `src/data/mockData.ts` importa `RoleType` de `@/lib/roles`.
- `Manager` nao aparece em `ROLE_TYPES` ou `ROLE_DEFINITIONS`.
- Nenhuma referencia ativa de runtime para `OrganizationChartV2`, `organization-chart-v2`, `useOrganizationTree` ou `use-organization-tree` foi encontrada; as referencias restantes sao avisos documentais.
- Migracoes historicas contem listas antigas de papeis, mas a migracao canonica de `Hunter Especializado` contem o conjunto atual. Nao tratar migracao antiga isolada como drift real.
- `src/lib/domain/customer-target-scope.ts` concentra a regra de escopo de clientes que compoem meta/New Logo.

## 6. Trabalho concluido

- `d1dd7b2 feat(roles): centralize role domain definitions and migrate active consumers`
- `3415af1 chore: harden role validation docs`
- `4546a30 docs: add agent handoff workflow`
- `npm run validate` inclui `npm run test:roles`.
- Deploy anterior conhecido da baseline `3415af1` foi inspecionado como Ready.
- Nesta sessao, foi migrada a capacidade `Target Customer Scope` para um contrato de dominio/backend-safe:
  - novo modulo: `src/lib/domain/customer-target-scope.ts`;
  - `customerCountsTowardTarget` continua definindo que `countsTowardTarget !== false` compoe meta;
  - `customerBelongsToTargetScope` centraliza a decisao por cliente;
  - `filterCustomersByTargetScope` centraliza a filtragem de listas quando o usuario inclui ou exclui New Logos.
- Consumidores atualizados: Clientes, Dashboard Executivo, Relatorio de Metas, Comparativo Baseline, Metas por Pessoa, Metas de Hunter Especializado e coverage view model.
- Teste de contrato adicionado: `scripts/verify-customer-target-scope.ts`.
- `npm run validate` agora inclui `npm run test:customer-scope`.

## 7. Trabalho pendente

- Manter este arquivo em commits documentais separados quando a alteracao for apenas coordenacao de agentes.
- Commitar a migracao atual em um commit de produto pequeno, se aprovado.
- Corrigir/decidir politica definitiva para avisos CRLF do Git; eles apareceram em `package.json` e `src/components/reports/person-target-report.tsx`, mas nao bloquearam validacoes.
- Em futura tarefa pequena, melhorar `scripts/verify-role-domain.cjs` para varrer novas constraints/RPCs de papeis sem confundir migracoes historicas supersedidas.
- Revisar comparacoes literais de papeis restantes e classificar como filtro intencional, label de UI ou candidato a helper.
- Reautenticar GitHub CLI antes de confiar em `npm run github:checks`.
- Capacidades duplicadas restantes mapeadas:
  - Studio contido / Meta Squads-Times liquida;
  - escopo de acesso Hunter;
  - composicao de portfolio cliente x pessoas;
  - agregacoes de relatorios oficiais;
  - KPIs executivos e comparativos com baseline;
  - analise de desafio por perfil/senioridade.

## 8. Validacoes

- Executadas nesta sessao:
  - `npm run test:customer-scope`: passou.
  - `npm run lint`: passou.
  - `npm run typecheck`: falhou uma vez por tipo fraco no teste/helper, corrigido, depois passou.
  - `npm run validate`: passou.
  - `npm run build`: passou.
  - `npm run test:performance`: passou.
- Nao executadas nesta sessao: smoke, Supabase migration check, deploy.
- Ultima baseline de produto conhecida passou anteriormente em: `npm run test:roles`, `npm run validate`, `npm run test:performance`, `npm run test:security`, `npm run smoke:critical`, `npm run build`, `npm run db:migrations:check`, `git diff --check`, `npm run deploy:check`, `npm run deploy:prod`, `npm run deploy:inspect:prod` e `npm run security:pentest-lite`.
- `npm run github:checks` falhou anteriormente por autenticacao do GitHub CLI, nao por erro de codigo.

## 9. Politica de commit e deploy

- Commits de handoff devem ficar separados de commits de produto.
- Este arquivo pode ser atualizado em commits documentais ou junto ao fim de uma entrega, desde que o escopo fique explicito.
- Nao incluir segredos, credenciais, dumps, logs transientes ou suposicoes nao verificadas.
- Deploy nao deve ser disparado para alteracoes apenas documentais.

## 10. Prompt de continuacao

Continue em `C:\Users\rmarchini\projetos\OrgBRQDelivery`. Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.squad/config.yaml`, `.squad/memory.md` e `docs/agent-handoff.md`. Use Git e codigo como fonte da verdade. Preserve `DeliveryRepository`, Supabase/RLS e `src/lib/roles.ts` como fonte canonica de papeis. Nao reintroduza `OrganizationChartV2`. Antes de qualquer commit de produto, rode as validacoes proporcionais ao impacto; antes de deploy, use apenas os scripts `npm run deploy:*`.
