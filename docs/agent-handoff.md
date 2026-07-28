# Agent Handoff — BRQ Delivery Coverage Hub

Artefato oficial de coordenacao entre Codex, Kilo, ChatGPT e outros agentes de engenharia. Manter factual, curto, baseado no repositorio e sem segredos, logs transientes ou conclusoes especulativas.

## 1. Metadata

- Atualizado em: 2026-07-28 12:16:00 -03:00
- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`
- Raiz local: `C:\Users\rmarchini\projetos\OrgBRQDelivery`
- Branch: `main`
- HEAD atual: `6226cd5 feat(audit): add traceability for access administration`
- Ultimo commit confirmado nesta sessao: `6226cd5 feat(audit): add traceability for access administration`
- Baseline de producao conhecida: nao verificado nesta sessao; valor historico conhecido era `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- URL de producao conhecida: `https://brq-delivery-coverage-hub.vercel.app`
- Agente gerador: Codex
- Proximo agente previsto: Kilo, Codex ou ChatGPT

## 2. Git status verificado

- `git status --short` apos o commit `6226cd5` e antes desta atualizacao:
  - `M .squad/memory.md`
  - `M docs/agent-handoff.md`
  - `M package.json`
  - `?? scripts/verify-person-target-audit.cjs`
  - `?? supabase/migrations/20260728120500_add_person_target_domain_audit.sql`
- `docs/agent-handoff.md` e `.squad/memory.md` representam o workstream atual de auditoria.
- `git diff --cached --stat`: sem staged changes.
- Commit do incremento atual de metas por pessoa: nao executado.
- Deploy: nao executado.

## 3. Objetivo atual

Architecture Epic: Audit Trail and Change Traceability.

Escopo atual: auditar uma segunda capacidade de negocio sensivel, metas por pessoa/cliente/ano (`revenue_target_allocations`). Nao aplicar migration em producao, nao alterar dados e nao fazer deploy.

## 4. Capacidade auditada

Capacidade ja commitada em `6226cd5`: administracao de perfis de acesso.

Capacidade atual pendente: metas por pessoa.

Inclui nesta fatia:

- insert/update/delete em `revenue_target_allocations`;
- alteracoes vindas da tela Metas por Pessoa via BFF/fallback;
- remocao por `remove_person_customer_targets`;
- campos de negocio: `customer_id`, `person_id`, `target_type`, `target_year`, `amount`, `own_amount`.

Exclui neste incremento:

- clientes, studios, portfolios, subjects e baselines;
- UI grande de timeline;
- aplicacao da migration em producao;
- testes RLS reais contra Supabase remoto.

## 5. Modelo do evento de auditoria

Migration base commitada: `supabase/migrations/20260728113530_add_app_access_domain_audit.sql`.

Migration atual pendente: `supabase/migrations/20260728120500_add_person_target_domain_audit.sql`.

Tabela reutilizada:

- `public.domain_audit_events`

Campos principais:

- `id`
- `occurred_at`
- `actor_user_id`
- `actor_person_id`
- `entity_type`
- `entity_id`
- `action`
- `previous_values`
- `new_values`
- `changed_fields`
- `source`
- `correlation_id`
- `request_id`
- `metadata`
- `status`
- `error_category`
- `created_at`

Acoes controladas ja existentes:

- `app_access.user.created`
- `app_access.user.updated`
- `app_access.user.deleted`
- `app_access.invite.created`
- `app_access.invite.updated`
- `app_access.invite.deleted`

Acoes adicionadas nesta fatia:

- `person_target.created`
- `person_target.updated`
- `person_target.deleted`

Privacidade:

- payload de acesso limitado a `email`, `role`, `active`, `user_id` quando aplicavel e `accepted_at` para convite;
- payload de meta por pessoa limitado a ids e valores de negocio, sem nomes ou e-mails;
- nao armazena tokens, secrets, stack traces ou payload completo de auth;
- email e dado pessoal, mas necessario para auditoria de acesso.

Retencao:

- sem purge automatico nesta migration;
- politica de retencao segue pendente de decisao operacional/legal.

## 6. Mecanismo escolhido

Mecanismo: trigger de banco + RPC audited source quando disponivel.

- `public.audit_app_access_profile_change()` gera eventos append-only em transacao com a mutacao.
- Triggers:
  - `app_users_domain_audit`
  - `app_access_invites_domain_audit`
- RPCs ajustadas:
  - `upsert_app_access` define `app.audit_source = rpc.upsert_app_access`
  - `delete_app_access` define `app.audit_source = rpc.delete_app_access`
- Escritas diretas nas tabelas de acesso tambem sao auditadas por trigger com `source = db.trigger`.
- `public.audit_person_target_change()` gera eventos para `revenue_target_allocations`.
- Trigger atual:
  - `revenue_target_allocations_domain_audit`
- `remove_person_customer_targets` define `app.audit_source = rpc.remove_person_customer_targets`.
- Escritas diretas/fallback em `revenue_target_allocations` sao auditadas por trigger com `source = db.trigger`.
- Falhas de mutacao nao geram evento de sucesso, porque o evento e gravado na mesma transacao.

## 7. Contrato de leitura

- RLS habilitado em `domain_audit_events`.
- `anon`: sem acesso.
- `authenticated`: apenas `select`.
- Policy: somente `public.is_delivery_admin()` pode ler.
- Aplicacao normal nao recebe `insert`, `update` ou `delete` na tabela de auditoria.
- UI de leitura foi deferida neste incremento; o contrato esta no banco e no teste.

## 8. Inventario resumido de mutacoes

| Capacidade | Entidade | Mutacao | Caminho atual | Autorizacao | Auditoria atual |
|---|---|---|---|---|---|
| Pessoas | `people` | save/delete/status/role | repository/RPC/fallback | editor/admin, alguns casos Hunter scoped | `audit_log` generico |
| Clientes | `customers`, `customer_target_years` | save/delete/targets | BFF/RPC/repository | editor/admin, Hunter create scoped | `audit_log` generico parcial |
| Responsaveis cliente | `person_customer_assignments` | replace/delete | RPC/repository | editor/admin/Hunter scoped propria pessoa | `audit_log` generico |
| Metas pessoa | `revenue_target_allocations` | upsert/delete | BFF/repository | editor/admin/Hunter scoped propria pessoa | `audit_log` generico + novo `domain_audit_events` pendente |
| Metas Studio | `studio_target_allocations` | upsert/delete | repository | editor/admin/Hunter scoped studio proprio | `audit_log` generico |
| Hunter Especializado | `specialist_hunter_studio_assignments` | RPC save | RPC | editor/admin | `audit_log` generico |
| Baselines | snapshot tables | insert/cleanup | repository/script | editor/admin/service role script | `audit_log` generico onde trigger existe |
| Acessos | `app_users`, `app_access_invites` | upsert/delete/accept | access RPCs | admin; accept self via auth | `audit_log` generico + novo `domain_audit_events` |

## 9. Bypass paths documentados

- `accessRepository` usa apenas RPCs `upsert_app_access` e `delete_app_access`; nao escreve direto em `app_users` ou `app_access_invites`.
- `configuracoes/page.tsx` usa `createAccessRepositorySelection`; nao chama RPC diretamente.
- RLS ainda permite admin gerenciar diretamente as tabelas de acesso; isso e coberto pelos triggers, mas fica com `source = db.trigger`.
- Scripts de provisionamento RLS usam service role e podem alterar acesso fora do fluxo UI; triggers devem registrar sucesso com ator nulo quando nao houver `auth.uid()`.
- Migrations historicas fazem backfills e correcoes; nao representam fluxo runtime auditavel completo.
- `savePersonCustomerTargets` ainda usa BFF e fallback direto no adapter Supabase; a auditoria por trigger cobre esse caminho sem mudar comportamento.

## 10. Validacoes executadas

- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run validate`: passou.
- `npm run build`: passou.
- `npm run smoke:critical`: passou.
- `npm run test:reports`: passou.
- `npm run test:performance`: passou.
- `npm run test:security`: passou.
- `npm run test:audit`: passou.
- `git diff --check`: passou sem erro de whitespace; exibiu aviso conhecido de CRLF em `package.json`.

Nao conclusivo:

- `npm run db:migrations:check`: falhou por falta de autenticacao Supabase (`SUPABASE_DB_URL`, login CLI ou `SUPABASE_ACCESS_TOKEN`). A falha nao confirmou drift.
- `npm run smoke:rls`: nao executado para evitar conexao com Supabase de producao sem ambiente local/perfis dedicados confirmados.

## 11. Riscos e pendencias

- Migration de acessos commitada, mas ainda nao aplicada localmente nem em producao nesta sessao.
- Migration atual de metas por pessoa nao aplicada localmente nem em producao.
- Sem teste real de transacao/RLS em banco local; o teste atual e verificacao de contrato SQL/repository.
- Nao ha UI de consulta de auditoria ainda.
- Retencao de eventos de auditoria ainda precisa decisao.
- Outras capacidades seguem apenas no `audit_log` generico e ainda nao tem `source`, `changed_fields` padronizado ou contrato de leitura especifico.

## 12. Proxima recomendacao

Boundary de commit recomendado para a fatia atual:

`feat(audit): add traceability for person targets`

Proxima capacidade auditavel recomendada:

- responsabilidade de cliente (`customers` + `person_customer_assignments`) ou metas por Studio (`studio_target_allocations`), dependendo de qual fluxo o usuario considerar mais critico para governanca.

## 13. Prompt de continuacao

Continue em `C:\Users\rmarchini\projetos\OrgBRQDelivery`. Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.squad/config.yaml`, `.squad/memory.md` e este arquivo. Use Git e codigo como fonte da verdade. Ha uma migration nova pendente para auditoria de metas por pessoa. Nao aplicar em producao sem autorizacao explicita. Antes de commitar, revisar `git diff`, repetir validacoes relevantes e manter este handoff alinhado.
