# Agent Handoff — BRQ Delivery Coverage Hub

Artefato oficial de coordenacao entre Codex, Kilo, ChatGPT e outros agentes de engenharia. Manter factual, curto, baseado no repositorio e sem segredos, logs transientes ou conclusoes especulativas.

## 1. Metadata

- Atualizado em: 2026-07-28 10:49:57 -03:00
- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`
- Raiz local: `C:\Users\rmarchini\projetos\OrgBRQDelivery`
- Branch: `main`
- HEAD atual: `136813633655ec0dddd5dfa27828114f9cfab00d`
- Baseline de produto local: `136813633655ec0dddd5dfa27828114f9cfab00d`
- Baseline de producao conhecida: `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- URL de producao conhecida: `https://brq-delivery-coverage-hub.vercel.app`
- Agente gerador: Codex
- Proximo agente previsto: Kilo, Codex ou ChatGPT

## 2. Git status verificado

- `git status --short` antes desta atualizacao:
  - `M src/app/api/delivery/customers/route.ts`
  - `M src/app/api/delivery/person-customer-targets/route.ts`
  - `M src/lib/repositories/contract-tests/deliveryRepository.contract.ts`
  - `M src/lib/repositories/localDeliveryRepository.ts`
  - `M src/lib/repositories/provider.ts`
  - `M src/lib/repositories/supabaseDeliveryRepository.ts`
  - `M src/lib/repositories/types.ts`
- `docs/agent-handoff.md` tambem foi atualizado nesta sessao.
- Sem arquivos untracked verificados antes desta atualizacao.
- `git diff --stat` antes do handoff: 7 arquivos, 74 insercoes e 20 remocoes.
- `git diff --cached --stat`: sem staged changes.
- `git diff --cached`: sem staged changes.

## 3. Objetivo atual

Architecture Epic: Repository Layer and Domain Services. Reduzir acoplamento direto com Supabase migrando apenas uma capacidade coesa para contrato explicito de repositorio, sem alterar comportamento, sem deploy e sem migracao Supabase.

## 4. Decisoes aprovadas

- `OrganizationChart` e a implementacao oficial do organograma.
- `OrganizationChartV2` nao deve ser reintroduzido.
- `src/lib/roles.ts` e a fonte canonica TypeScript para papeis de dominio.
- Valores persistidos de papel permanecem: `Executive`, `Director`, `Farmer + Delivery`, `Delivery`, `Hunter`, `Hunter Especializado`, `Farmer`, `Hunter + Farmer`, `Staff`.
- `Manager` nao e `RoleType` persistido.
- `DeliveryRepository` deve continuar sendo a fronteira principal da aplicacao para persistencia.
- Regras criticas e filtros de permissao nao devem depender apenas de UI.

## 5. Mapa de acoplamento Supabase verificado

- UI-level direct access: nenhum uso ativo de `.from(...)`, `.select(...)` ou `.rpc(...)` em componentes React; textos de UI ainda citam Supabase em contexto de importacao.
- Hook/controller access: `src/app/api/delivery/customers/route.ts` e `src/app/api/delivery/person-customer-targets/route.ts` tinham leituras diretas de `customers` e `people` para validar escrita escopada de Hunter.
- Existing repository abstraction: `src/lib/repositories/supabaseDeliveryRepository.ts` concentra a maior parte de `.from(...)`, `.rpc(...)`, mapeadores snake_case/camelCase e fallback RPC.
- Existing service abstraction: `src/lib/auth/auth-service.ts` e `src/lib/repositories/accessRepository.ts` encapsulam auth/acesso, ainda com tipos Supabase no contrato interno.
- Database contract: `supabase/migrations/**` contem tabelas, constraints, RPCs, RLS e triggers; nao alterado nesta sessao.
- Validation/test fixture: scripts em `scripts/**` usam Supabase CLI/client para smoke, seguranca, limpeza ou validacao operacional; nao sao consumidores UI.
- Dead/obsolete code: nao identificado nesta sessao.

## 6. Capacidade extraida nesta sessao

Capacidade: leitura de entidades para validacao de escopo dos comandos Delivery.

Contrato adicionado em `DeliveryRepository`:

- `findCustomerById(id): Promise<Customer | null>`
- `findPersonById(id): Promise<Person | null>`

Regras preservadas:

- Hunter scoped write pode criar novo cliente, mas nao editar cliente existente.
- Hunter scoped write em metas por pessoa so pode alterar metas vinculadas a propria pessoa autenticada.
- BFF continua validando sessao, app role e autorizacao via `createDeliveryCommandClient`.
- Supabase/RLS/RPC nao foram removidos nem contornados.

Arquivos afetados:

- `src/lib/repositories/types.ts`
- `src/lib/repositories/localDeliveryRepository.ts`
- `src/lib/repositories/supabaseDeliveryRepository.ts`
- `src/lib/repositories/provider.ts`
- `src/app/api/delivery/customers/route.ts`
- `src/app/api/delivery/person-customer-targets/route.ts`
- `src/lib/repositories/contract-tests/deliveryRepository.contract.ts`
- `docs/agent-handoff.md`

Risco de migracao: baixo. Mudanca remove query direta dos BFFs e reaproveita mapeadores existentes do adapter Supabase.

## 7. Validacoes executadas

- `npm run test:contracts`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run validate`: passou.
- `npm run build`: passou.

Nao executadas:

- `npm run smoke:critical`: nao executado; mudanca nao alterou tela ou fluxo de persistencia pelo browser.
- `npm run db:migrations:check`: nao executado; nenhuma migracao/schema/RLS foi alterado.
- Deploy: nao executado por instrucao explicita.

## 8. Trabalho pendente

- Revisar diff final e decidir commit de produto para a extracao de repository contract.
- Se for commitar, boundary recomendado: `refactor: route delivery command reads through repository`.
- Atualizar este handoff depois do commit com o novo HEAD.
- Capacidades duplicadas restantes para futuras extracoes:
  - Studio contido / Meta Squads-Times liquida;
  - escopo de acesso Hunter e filtros por usuario logado;
  - composicao de portfolio cliente x pessoas;
  - agregacoes de relatorios oficiais;
  - KPIs executivos e comparativos com baseline;
  - analise de desafio por perfil/senioridade;
  - auth/access repository sem tipos Supabase expostos.

## 9. Politica de commit e deploy

- Commits documentais de handoff devem ficar separados quando forem apenas coordenacao.
- Este handoff pode acompanhar commit de produto quando documenta a entrega da propria sessao.
- Nao deployar esta sessao.
- Antes de deploy futuro, usar somente `npm run deploy:check`, `npm run deploy:prod` e `npm run deploy:inspect:prod`.

## 10. Prompt de continuacao

Continue em `C:\Users\rmarchini\projetos\OrgBRQDelivery`. Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.squad/config.yaml`, `.squad/memory.md` e este arquivo. Use Git e codigo como fonte da verdade. Preserve `DeliveryRepository`, Supabase/RLS/RBAC e `src/lib/roles.ts`. Nao reintroduza `OrganizationChartV2`. Para continuar a arquitetura, escolha apenas uma capability por vez; proxima recomendada: escopo de acesso Hunter/filtros por usuario logado, desde que sem migracao ampla.
