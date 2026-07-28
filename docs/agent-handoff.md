# Agent Handoff — BRQ Delivery Coverage Hub

Artefato oficial de coordenacao entre Codex, Kilo, ChatGPT e outros agentes de engenharia. Manter factual, curto, baseado no repositorio e sem segredos, logs transientes ou conclusoes especulativas.

## 1. Metadata

- Atualizado em: 2026-07-28 11:20:18 -03:00
- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`
- Raiz local: `C:\Users\rmarchini\projetos\OrgBRQDelivery`
- Branch: `main`
- HEAD atual: `3ee5572aabe9b736f363d049932f873b0126de67`
- Baseline local confirmado antes desta sessao: `3ee5572aabe9b736f363d049932f873b0126de67`
- Baseline de producao conhecida: nao verificado nesta sessao; valor anterior conhecido era `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- URL de producao conhecida: `https://brq-delivery-coverage-hub.vercel.app`
- Agente gerador: Codex
- Proximo agente previsto: Kilo, Codex ou ChatGPT

## 2. Git status verificado

- `git status --short` antes da atualizacao deste handoff:
  - `M package.json`
  - `?? scripts/verify-hunter-scoped-customer-create-security.cjs`
  - `?? supabase/migrations/20260728111436_harden_hunter_scoped_customer_create.sql`
- `docs/agent-handoff.md` e `.squad/memory.md` foram atualizados depois dessa leitura.
- `git diff --stat` antes do handoff mostrava alteracao em `package.json`; arquivos novos ainda nao apareciam no stat por estarem untracked.
- `git diff --cached --stat`: sem staged changes.
- Commit/deploy: nao executados nesta sessao.
- `git status --short` final:
  - `M .squad/memory.md`
  - `M docs/agent-handoff.md`
  - `M package.json`
  - `?? scripts/verify-hunter-scoped-customer-create-security.cjs`
  - `?? supabase/migrations/20260728111436_harden_hunter_scoped_customer_create.sql`

## 3. Objetivo atual

Security Epic: Authorization and RLS Hardening.

Escopo implementado: endurecer uma unica capacidade de seguranca, a criacao de cliente por usuario `hunter_viewer`/Consulta Hunter via BFF + RPC transacional. Nao aplicar migration em producao, nao alterar dados, nao fazer deploy.

## 4. Decisoes aprovadas preservadas

- `DeliveryRepository` continua sendo a fronteira principal de persistencia da aplicacao.
- Operacoes sensiveis de escrita Delivery continuam passando por BFF com token do usuario e validacao de app access.
- Supabase Auth, RLS, RBAC e RPCs continuam ativos; nada foi removido ou contornado.
- Simulacao admin permanece apenas UI/visao; nao altera token, usuario auditado ou decisao RLS.
- Regras criticas nao podem depender apenas de filtro/estado de UI.
- Migrations historicas nao devem ser reescritas; correcoes devem ser forward-only.

## 5. Mapa de acoplamento e superficie de seguranca verificada

- Auth de escrita Delivery: `src/server/auth/delivery-command-access.ts` valida Bearer token com `client.auth.getUser(token)` e resolve app access por `accept_current_app_access`.
- BFF de cliente: `src/app/api/delivery/customers/route.ts` permite `allowHunterScopedWrite`, mas bloqueia Hunter scoped quando o cliente ja existe e remove `managerResponsibleIds` antes da RPC.
- BFF de metas pessoa/cliente: `src/app/api/delivery/person-customer-targets/route.ts` bloqueia Hunter scoped de aumentar meta do cliente e exige que `personId` corresponda ao e-mail autenticado.
- UI de escopo Hunter: `src/lib/hunter-access-scope.ts` filtra visibilidade/edicao, mas nao e considerada fronteira de seguranca.
- Banco/RLS/RPC: `supabase/migrations/20260721103000_hunter_scoped_access.sql` ja tinha helpers para identidade Hunter, person scope e studio scope; a sessao adicionou helper especifico para criacao de cliente.
- Scripts de seguranca existentes: `scripts/verify-security-hardening.cjs`, `scripts/smoke-rls-access.mjs`, `scripts/security-check.mjs`.

## 6. Capacidade endurecida nesta sessao

Capacidade: criacao de cliente por Consulta Hunter.

Nova regra de banco:

- `public.can_hunter_scope_create_customer(p_customer_id, p_manager_responsible_ids)` retorna verdadeiro somente quando:
  - existe identidade ativa `hunter_viewer` mapeada para pessoa ativa com papel Hunter/Hunter + Farmer/Hunter Especializado;
  - o id do cliente nao esta vazio;
  - o cliente ainda nao existe em `public.customers`;
  - nao ha `manager_responsible_ids` enviados.

RPC reforcada:

- `public.save_customer_with_managers_and_targets(...)` passa a calcular `v_hunter_scoped_create` via helper de banco antes de qualquer escrita.
- Para usuarios sem `can_write_delivery_hardening()`, a RPC preserva as mensagens atuais e so cria o vinculo `rpc_hunter_customer_create` quando o helper autorizou o fluxo.
- Conflitos de upsert em `customers` e `customer_target_years` so atualizam quando `v_can_edit` e verdadeiro; Consulta Hunter falha em vez de converter criacao concorrente em update.
- Editor/admin mantem o comportamento existente.

## 7. Arquivos modificados

- `supabase/migrations/20260728111436_harden_hunter_scoped_customer_create.sql`
- `scripts/verify-hunter-scoped-customer-create-security.cjs`
- `package.json`
- `docs/agent-handoff.md`
- `.squad/memory.md`

## 8. Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run validate`: passou.
- `npm run build`: passou.
- `npm run smoke:critical`: passou.
- `npm run test:reports`: passou.
- `npm run test:performance`: passou.
- `npm run test:security`: passou, incluindo o novo verificador `verify-hunter-scoped-customer-create-security.cjs`.
- `git diff --check`: passou sem erro de whitespace; exibiu apenas aviso Windows de normalizacao CRLF em `package.json`.

Validacoes pendentes/nao conclusivas:

- `npm run db:migrations:check`: falhou por falta de autenticacao Supabase (`SUPABASE_DB_URL`, login CLI ou `SUPABASE_ACCESS_TOKEN`). A falha nao confirmou drift.
- `npm run smoke:rls`: nao executado nesta sessao para evitar conexao com Supabase de producao sem um ambiente local/perfil dedicado confirmado.
- Migration nova nao foi aplicada por instrucao explicita.
- Deploy nao foi executado por instrucao explicita.

## 9. Riscos e pendencias

- A migration forward precisa ser aplicada em ambiente controlado antes de deploy futuro.
- A checagem de historico Supabase precisa ser reexecutada com autenticacao configurada.
- `test:security` agora cobre o contrato estatico BFF + SQL desta capacidade; teste RLS real continua dependente de perfis dedicados/local Supabase.
- O aviso CRLF em `package.json` permanece como normalizacao Git/Windows, sem falha de diff.

## 10. Proxima recomendacao

Boundary de commit recomendado, se aprovado:

`fix(security): harden hunter scoped customer creation`

Proxima capability de seguranca, depois deste commit: cobertura RLS real/local para `hunter_viewer` em criacao de cliente e edicao de metas sem usar producao.

## 11. Prompt de continuacao

Continue em `C:\Users\rmarchini\projetos\OrgBRQDelivery`. Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.squad/config.yaml`, `.squad/memory.md` e este arquivo. Use Git e codigo como fonte da verdade. Ha uma migration nova pendente para hardening de criacao de cliente por Consulta Hunter. Nao aplicar em producao sem autorizacao explicita. Antes de commitar, revisar `git diff`, repetir validacoes relevantes e manter `docs/agent-handoff.md` alinhado ao HEAD/working tree.
