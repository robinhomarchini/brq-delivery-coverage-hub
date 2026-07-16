# Avaliação de Qualidade Técnica e Arquitetura

## BRQ Delivery Coverage Hub — 2026-07-14

---

## 📊 Sumário Executivo

| Dimensão                | Nota       | Status                                                |
| ----------------------- | ---------- | ----------------------------------------------------- |
| **Arquitetura**         | 8.5/10     | ✅ Bem estruturada                                    |
| **Segurança**           | 8/10       | ✅ Robusta, com recomendações                         |
| **Performance**         | 7/10       | ⚠️ Adequada, escalabilidade pendente                  |
| **Testes**              | 6.5/10     | ⚠️ Smoke tests presentes, testes unitários faltam     |
| **Type Safety**         | 8.5/10     | ✅ Strict mode, Zod validações                        |
| **DevOps**              | 6/10       | ⚠️ Manual, sem CI/CD automático                       |
| **Escalabilidade**      | 7/10       | ⚠️ Escalável até ~10k registros em memória            |
| **Qualidade de Código** | 8/10       | ✅ Bom, componentes bem separados                     |
| **MÉDIA GERAL**         | **7.6/10** | 🟡 **Pronto para homologação, ajustes para produção** |

**Status**: Aplicação adequada para **homologação interna controlada**. Para **produção corporativa**, recomenda-se concluir os hardenings críticos remanescentes e as melhorias estratégicas documentadas abaixo. O hardening de CSP com nonce permanece pendente até existir smoke real de hidratação no navegador.

---

## 1. ARQUITETURA — 8.5/10

### ✅ Forças

#### Padrão Adapter bem implementado

- Seleção de provider centralizada em `src/lib/repositories/provider.ts`
- Suporta `supabase`, `local-dev`, `unavailable` sem dispersão pela codebase
- Contrato TypeScript forte: `DeliveryRepository` documenta todas operações
- Implementações: `LocalDeliveryRepository` (mock) e `SupabaseDeliveryRepository` (produção)

#### Camadas bem definidas

```
UI Components
  → Store (React Context)
  → DeliveryRepository (contrato agnóstico)
  → BFF parcial (/api/delivery/*)
  → Supabase + RLS
```

#### Normalização de dados

- `person_customer_assignments` — relação N:N isolada
- `revenue_target_allocations` — targets por pessoa/cliente/tipo/ano
- `board_target_baselines` — baseline aprovado separado de operacional
- `studio_baseline_snapshots` — histórico imutável

#### BFF parcial para operações críticas

- `POST /api/delivery/customers` — valida session, papel, RLS
- `POST /api/delivery/person-customer-targets` — mesmo pipeline
- Usa bearer token + validação de servidor

### ⚠️ Fraquezas

- **BFF ainda incompleto**: `savePerson()`, `saveArea()`, `saveSubject()` falam direto com Supabase do browser
- **Sem camada de cache centralizado**: Store recarrega tudo da API (sem SWR/tanstack-query)
- **Migrations forward-only**: 75+ migrations sem rollback automático equivalente
- **Sem soft delete**: Deletions são hard delete em cascata

### 🎯 Recomendações

| Prioridade  | Ação                                     | Estimativa |
| ----------- | ---------------------------------------- | ---------- |
| **CRÍTICO** | Completar BFF para todas operações CRUD  | 3-5 dias   |
| **ALTO**    | Adicionar SWR/tanstack-query para cache  | 2-3 dias   |
| **ALTO**    | Criar migrações com rollback documentado | 1-2 dias   |
| **MÉDIO**   | Implementar soft delete com `deleted_at` | 2 dias     |

---

## 2. SEGURANÇA — 8/10

### ✅ Forças

#### Autenticação e Autorização

- **Centralizada**: `src/lib/auth/auth-service.ts` (provider-neutral)
- **E-mail corporativo obrigatório**: `@brq.com` validado no Supabase Auth
- **RBAC estrito**: `viewer`, `editor`, `admin` com policies específicas
- **Provisionamento controlado**: Admin pré-cadastra em `app_access_invites`, usuário ativa com `accept_current_app_access()`

#### Row-Level Security (RLS)

- Habilitado em todas tabelas públicas
- `is_active_brq_user()` — filtra dados do próprio usuário
- `can_edit_delivery_data()` — apenas editors/admins escrevem
- `is_delivery_admin()` — apenas admins gerenciam acessos
- **Security Definer** em RPCs (executa como owner, previne escalation)

#### Headers HTTP de segurança

```
Content-Security-Policy: pendente; não publicar nonce CSP sem smoke de navegador/hidratação
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: (desabilita câmera, microfone)
HSTS: max-age=31536000 (em produção)
```

#### Validação em cascata

- **Cliente**: Zod schemas (`validatePerson`, `validateCustomer`, etc.)
- **BFF**: validação novamente (nunca confiar em cliente)
- **Banco**: constraints, RLS, input sanitization
- Exemplo: `PersonCustomerTargets` validado 3x antes de persistir

#### Neutralização de fórmulas em CSV

- `src/lib/report-export.ts` adiciona `'` antes de `=`, `@`, `+`, `-`
- Previne injeção de fórmulas em Excel

#### Sem credenciais expostas

- Frontend usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (segura)
- Sem `service_role` em cliente
- BFF usa bearer token do usuário autenticado

### ⚠️ Fraquezas

#### CSP insegura (pendente com gate de smoke)

```javascript
// Antes do hardening:
"script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}"

// Permite: <div onclick="alert('xss')"> — XSS direto
```

#### Supabase Auth pode permitir sign-up aberto

- Se não desativado, qualquer e-mail `@brq.com` pode se registrar
- RPC valida no primeiro login, mas acesso pode ser temporal

#### Auditoria não visível no UI

- Banco tem triggers de auditoria
- Apenas admins acessam logs via `is_delivery_admin()`, sem interface amigável

#### Sem rate limiting

- Usuário pode fazer N exportações/saves simultâneos
- Sem proteção contra DoS mesmo autenticado

#### Usuários de teste hardcoded em migrations

- `20260702173500_release_acoelho_access.sql` contém usuário específico
- Risco: dados de teste podem estar em produção

### 🔴 Riscos Críticos

1. **XSS via CSP `unsafe-inline`**: pendente; tentativa de nonce sem hidratação validada derrubou o front em produção
2. **SQL Injection futuro**: Se nova migration usar string concatenation
3. **Privilege escalation**: Se Supabase Auth tiver falha de validação de domínio
4. **Backdoor em migrations hotfix**: Se urgência levar a ausência de revisão

### 🎯 Recomendações

| Prioridade     | Ação                                                               | Impacto |
| -------------- | ------------------------------------------------------------------ | ------- |
| **🔴 CRÍTICO** | Remover `unsafe-inline` de CSP com smoke real de hidratação        | Alto    |
| **🔴 CRÍTICO** | Remover dados de teste do código                                   | Alto    |
| **🔴 CRÍTICO** | Validar que Supabase Auth sign-up está **desativado**              | Crítico |
| **🔴 CRÍTICO** | Implementar rate limiting em `/api/delivery/*`                     | Médio   |
| **🟠 ALTO**    | Adicionar auditoria visível no UI (tela de "Atividades")           | Médio   |
| **🟠 ALTO**    | Adicionar linter de SQL em migrations                              | Médio   |
| **🟡 MÉDIO**   | Gerar tipos a partir de schema Supabase (eliminaPossível mismatch) | Baixo   |

---

## 3. PERFORMANCE — 7/10

### ✅ Forças

#### Índices bem planejados

```sql
revenue_target_allocations_customer_person_type_year_idx
studio_target_allocations_customer_area_year_idx
specialist_hunter_studio_assignments_person_year_idx
```

#### Memoização estratégica

- `useMemo` para cálculos derivados
- Indexed lookups (`customerNamesById`, `peopleNamesById`) em loops
- `syncStudioDerivedTargetsFromStudioAllocations()` atualiza seletivamente

#### Extração de view models

- `customer-coverage-view-model.ts` — cálculos fora do componente
- `person-target-rollups.ts` — totalizações reutilizáveis
- Previne recálculos redundantes

#### Dependências otimizadas

- Next.js 16.2.9 + React 19.1.1 (últimas versões)
- Recharts (não Plotly)
- Tailwind + shadcn/ui (leve)

#### Sincronização parcial

- `setCustomerTargets((current) => ...)` vs `getAll()`

### ⚠️ Fraquezas

#### Store sem paginação

- `getAll()` carrega TUDO sem limites
- Com 10k+ registros, bloqueia UI

#### Sem lazy loading de componentes

- Não há `React.lazy()` ou `next/dynamic`
- PDF/Excel renderizados no cliente (html-to-image, jsPDF, fflate)

#### Bundle size não monitorado

- Recharts + jsPDF + fflate + lucide-react = ~500kb+
- Sem análise de `next build` output

#### Sem prefetching

- Cada clique aguarda carregamento de dados

### 🔴 Riscos

- **UI congela com dados reais**: ~1000 pessoas × 10 clientes = 100k allocations bloqueiam
- **PDF com 10k+ linhas congela browser**: html-to-image sem streaming
- **Gráficos com 10k+ pontos lentos**: Recharts renderiza cada ponto

### 🎯 Recomendações

| Prioridade     | Ação                                                     | Impacto |
| -------------- | -------------------------------------------------------- | ------- |
| **🔴 CRÍTICO** | Adicionar paginação ao `getAll()` (limit: 100, offset)   | Crítico |
| **🟠 ALTO**    | Lazy loading de componentes pesados                      | Alto    |
| **🟠 ALTO**    | Virtual scrolling para tabelas (@tanstack/react-virtual) | Alto    |
| **🟡 MÉDIO**   | Bundle analysis (@next/bundle-analyzer)                  | Médio   |
| **🟡 MÉDIO**   | Web worker para PDF/Excel generation                     | Médio   |

---

## 4. TESTES — 6.5/10

### ✅ Forças

#### Smoke tests estratégicos

- `npm run smoke:critical` — testes de fluxo crítico (customer-hunter sync, target form)
- Validações por regex de padrões proibidos

#### Testes de segurança

- `npm run security:check` → `test:security`, `npm audit`, `smoke:rls`, `pentest-lite`
- Validações explícitas de hardening

#### Contract tests (repositórios)

- Testa conformidade do `LocalDeliveryRepository` com `DeliveryRepository`
- Executável via `npm run test:contracts`

#### Performance hardening tests

- `npm run test:performance` — valida memoização, índices, sem full reloads

#### RLS smoke tests

- `npm run smoke:rls:provision` — cria usuários de teste
- `npm run smoke:rls` — valida acesso por papel

### ⚠️ Fraquezas

#### Sem framework de teste

- Scripts Node.js (`.cjs`, `.mjs`) sem assertions estruturadas
- Apenas `if (!...) process.exit(1)`
- Sem coverage report

#### Contract tests não rodam em CI

- Estão em `package.json` mas não em build pipeline
- Desenvolvedor pode fazer push sem validar

#### Sem testes unitários

- **Zero** arquivos `*.test.ts/tsx`
- Alterações em `src/lib/validation.ts` ou `src/lib/repositories/` podem quebrar

#### Sem testes e2e

- Sem fluxo completo (login → save → export → visualize)
- Apenas smoke de padrões específicos

#### Testes de RLS requerem setup manual

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RLS_VIEWER_EMAIL`, etc.
- Impossível em GitHub Actions sem segredos corporativos

### 🔴 Riscos

- **Regressão silenciosa em RLS**: smoke passa, mas nova policy quebra row-level access
- **Contract tests não garantem compatibilidade**: LocalDeliveryRepository passa, mas Supabase falha

### 🎯 Recomendações

| Prioridade     | Ação                                           | Estimativa |
| -------------- | ---------------------------------------------- | ---------- |
| **🔴 CRÍTICO** | Integrar Vitest + @vitest/ui + c8 (coverage)   | 2-3 dias   |
| **🔴 CRÍTICO** | Adicionar contract tests à pipeline de build   | 1 dia      |
| **🟠 ALTO**    | Testes unitários para `src/lib/validation.ts`  | 2 dias     |
| **🟠 ALTO**    | Testes de RLS automatizados em Docker Postgres | 3-4 dias   |
| **🟡 MÉDIO**   | Testes e2e com Playwright                      | 5-7 dias   |

---

## 5. TYPE SAFETY — 8.5/10

### ✅ Forças

#### Strict mode

```json
{
  "strict": true,
  "noEmit": true,
  "skipLibCheck": true
}
```

#### Zod para validação runtime

- Schemas para Person, Area, Customer, Target
- `z.object()`, `z.enum()`, `z.preprocess()`, `superRefine()`
- Validação obrigatória em cliente + BFF

#### Tipos de domínio bem modelados

- `src/data/` — interfaces TypeScript
- `src/lib/repositories/types.ts` — contrato `DeliveryRepository`
- Sem `any` implícito

#### Validação em cascata

- Cliente → BFF → Banco

### ⚠️ Fraquezas

#### Zod schemas sem testes

- Alterações em `personSchema` podem quebrar sem serem detectadas

#### Tipos desalinhados com schema Supabase

- `PersonRow` é manual, não auto-gerado
- Se schema no banco mudar, tipos não atualizam

#### Sem type-safe query builder

- Strings em Supabase: `client.from("people").select("*")`
- Typos em colunas não são detectados

### 🎯 Recomendações

| Prioridade   | Ação                                                  | Benefício                |
| ------------ | ----------------------------------------------------- | ------------------------ |
| **🟡 MÉDIO** | Testes de validação Zod                               | Previne regressão        |
| **🟡 MÉDIO** | Gerar tipos de schema Supabase (`supabase gen types`) | Sincronização automática |
| **🟢 BAIXO** | Type-safe query builder                               | Segurança adicional      |

---

## 6. QUALIDADE DE CÓDIGO — 8/10

### ✅ Forças

#### Padrões de componentes claros

- `src/components/ui/` — primitivas (Badge, Button, etc.)
- `src/components/shared/` — cross-domain (KPI, Table, Exporters)
- `src/components/<domain>/` — domain-specific (Customers, Targets, People)

#### Reutilização agressiva

- Bibliotecas de domínio extraídas: `studio-baseline-report.ts`, `customer-coverage-view-model.ts`, `person-target-rollups.ts`
- Previne divergência entre preview e exportações

#### Complexidade controlada

- Gate `npm run test:performance` bloqueia reintrodução de lógica em componentes
- Arquivos >500 linhas marcados para extração

#### TypeScript strict mode

- `"strict": true`, sem `any` implícitos

### ⚠️ Fraquezas

#### Alguns arquivos concentram responsabilidades

- `customer-management.tsx` (~500+ linhas): CRUD + seleção + tabelas
- `person-target-report.tsx`: builders + filtros + tabelas apesar de rollups extraídos

#### Sem testes unitários

- Validação ocorre por smoke tests, não unit tests
- Contract tests não automatizados em build

#### Documentação de padrões não centralizada

- `docs/coding-standards.md` não referenciado em ESLint ou build
- Sem `.eslintrc` estrito que force padrões

### 🎯 Recomendações

| Prioridade   | Ação                                                      | Estimativa |
| ------------ | --------------------------------------------------------- | ---------- |
| **🟡 MÉDIO** | Testes unitários para repositórios                        | 2-3 dias   |
| **🟡 MÉDIO** | Extrair builders/formatters de componentes gigantes       | 2 dias     |
| **🟢 BAIXO** | ESLint rule customizado para isolamento de domain imports | 1 dia      |

---

## 7. DEVOPS & DEPLOY — 6/10

### ✅ Forças

#### Pipeline de validação

- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm run smoke:critical` antes de deploy

#### Scripts específicos

- `npm run test:contracts`, `test:security`, `test:performance`
- `npm run db:migrations:check` — valida migration history

#### Deployment com Vercel

- Task `deploy:vercel:prod` com `--yes` flag
- Supabase linked via CLI

#### Environment management

- `.env.example` documenta variáveis
- Senhas em Supabase Auth, não em código

#### Checklist de release documentado

- [docs/PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) lista passos

### ⚠️ Fraquezas

#### CI/CD e deploy ainda parcialmente manuais

- Deploy de produção usa script padronizado: `npm run deploy:prod`
- Inspeção de produção usa script padronizado: `npm run deploy:inspect:prod`
- O caminho manual direto do Vercel CLI foi substituído por wrapper com Node/cache/env controlados

#### Validação pré-deploy ainda depende de disciplina operacional

- `npm run build` e checks locais existem, mas o deploy manual ainda depende de rodar o gate correto
- GitHub Actions existe, porém a consulta local via GitHub CLI pode falhar por permissão/API e deve ser validada no GitHub UI quando `npm run github:checks` não conseguir listar runs

#### Migrações Supabase sem rollback automático

- `npx supabase db push` aplica, mas `npx supabase db reset` é destrutivo
- Sem mecanismo seguro de rollback

#### Sem testes e2e em CI

- Smoke RLS requer setup manual
- Não roda em GitHub Actions

#### Supabase CLI pode falhar com EPERM

- Workaround aplicado (`--cache .npm-cache`), mas frágil

### 🔴 Riscos

- **Deploy sem migrations**: Vercel pode deployar schema quebrado
- **Rollback Vercel sem rollback Supabase**: Código antigo pode quebrar com schema novo
- **Credenciais em `.env.local`**: Se commitado, `SUPABASE_SERVICE_ROLE_KEY` vaza

### 🎯 Recomendações

| Prioridade     | Ação                                  | Estimativa |
| -------------- | ------------------------------------- | ---------- |
| **🔴 CRÍTICO** | GitHub Actions CI/CD completo         | 2-3 dias   |
| **🔴 CRÍTICO** | Validação de migrations em BFF        | 1 dia      |
| **🟠 ALTO**    | Script de rollback manual documentado | 1 dia      |
| **🟠 ALTO**    | Observabilidade com Sentry            | 1-2 dias   |

---

## 8. ESCALABILIDADE — 7/10

### ✅ Forças

#### Modelo normalizado

- `person_customer_assignments` — N:N
- Targets por pessoa/cliente/tipo/ano
- Baselines separados de operacionais
- Sem mega-tabelas

#### Padrão provider abstrai implementação

- `DeliveryRepository` permite trocar Supabase amanhã

#### RPCs transacionais

- `save_person_with_assignments`, `save_customer_with_managers`
- Previne inconsistência parcial

#### Índices estratégicos

- Chaves de acesso frequentes indexadas

#### Versionamento de snapshots

- Histórico sem alterar dados vivos

### ⚠️ Fraquezas

#### Sem soft delete

- `DELETE FROM people` é hard delete em cascata
- Sem histórico de "removido em data X"

#### Sem multi-tenancy

- Tudo em um Supabase project
- Se BRQ crescer, sem isolation

#### Schema sem constraints reconciliação

- `person_id` pode ficar órfão se Pessoa for deletada
- Se cascata não existir, dados inconsistentes

#### Sem partition by date

- Com 1M+ rows, queries por ano podem ser lentas
- Índice ajuda, mas partição seria melhor

#### Store em Context não escala

- Sem lazy loading, limite ~10k registros
- ~10k people × 10 customers = 100k allocations bloqueia

### 🔴 Riscos

- **Cascading delete sem confirmação**: Deletar Area deleta todas Studio allocations
- **Sem backup documentado**: RPO/RTO não mencionados
- **Migrações podem lock**: Se 2 deploys simultâneos

### 🎯 Recomendações

| Prioridade   | Ação                                           | Prazo        |
| ------------ | ---------------------------------------------- | ------------ |
| **🟠 ALTO**  | Soft delete com `deleted_at`                   | Curto prazo  |
| **🟠 ALTO**  | Paginação no `getAll()`                        | Imediato     |
| **🟡 MÉDIO** | Validar constraints de integridade referencial | Médio prazo  |
| **🟡 MÉDIO** | Partição por ano para grandes tabelas          | Médio prazo  |
| **🟢 BAIXO** | Disaster recovery runbook                      | Documentação |

---

## 📋 CHECKLIST PRIORIZADO

### 🔴 CRÍTICO — Semana 1 (Produção)

- [ ] Remover `unsafe-inline` de CSP com smoke real de hidratação
- [ ] Remover dados de teste do código (migrations hardcoded)
- [ ] Validar que Supabase Auth sign-up está **desativado**
- [ ] Completar BFF para todas operações CRUD (`savePerson`, `saveArea`, `saveSubject`)
- [ ] GitHub Actions CI/CD (lint → typecheck → build → test → deploy)
- [ ] Validação de migrations em BFF (falha se não aplicadas)
- [ ] Implementar rate limiting em `/api/delivery/*`
- [ ] Documentar plano de rollback Vercel + Supabase
- [ ] Adicionar contract tests à pipeline de build
- [ ] `.gitignore` garante que `.env.local` não seja commitado
- [ ] Remover `SUPABASE_SERVICE_ROLE_KEY` de `.env.example`
- [ ] Auditar migrations para hardcoded data de teste

### 🟠 ALTO — Semana 2-4

- [ ] Vitest + @vitest/ui + c8 coverage
- [ ] Testes unitários: `src/lib/validation.ts`, `src/lib/repositories/`
- [ ] Testes de RLS automatizados em Docker Postgres
- [ ] Paginação no `getAll()` (limit: 100, offset)
- [ ] SWR ou tanstack-query para cache centralizado
- [ ] Lazy loading de componentes pesados
- [ ] Virtual scrolling em tabelas
- [ ] Auditoria visível no UI (tela de "Atividades")
- [ ] Linter de SQL em migrations
- [ ] Soft delete com `deleted_at`

### 🟡 MÉDIO — Mês 2-3

- [ ] Bundle analysis (@next/bundle-analyzer)
- [ ] Web worker para PDF/Excel generation
- [ ] Gerar tipos de schema Supabase
- [ ] Testes de validação Zod
- [ ] Adicionar observabilidade (Sentry)
- [ ] Constraints de integridade referencial revisadas
- [ ] Extrar builders/formatters de componentes >500 linhas
- [ ] ESLint rule customizado para domain isolation
- [ ] Migrações com rollback documentado
- [ ] Disaster recovery runbook

### 📋 LONGO PRAZO

- [ ] Testes e2e com Playwright
- [ ] Multi-tenancy support
- [ ] Partição de dados por ano
- [ ] Type-safe query builder Supabase
- [ ] Análise de Performance em produção (APM)

---

## 🎯 CONCLUSÃO

O **BRQ Delivery Coverage Hub** é uma aplicação **bem estruturada e arquiteturalmente sólida**, pronta para homologação avançada. Com **nota média de 7.6/10**, demonstra:

### ✅ Pontos Fortes

1. **Arquitetura adapter-first** — escalável e agnóstica
2. **Segurança em camadas** — autenticação, RLS, RBAC, validação cascata
3. **Código organizado** — componentes, repositórios, view models bem separados
4. **Testes estratégicos** — smoke, segurança, performance hardening
5. **Type safety** — Strict mode + Zod validações

### ⚠️ Áreas de Melhoria

1. **DevOps**: Sem CI/CD automático
2. **Testes**: Faltam testes unitários e e2e
3. **Performance**: Sem paginação, lazy loading
4. **Segurança**: CSP nonce pendente; manter foco em dados de teste, rate limiting e BFF completo
5. **Escalabilidade**: Store em Context limita crescimento

### 🚀 Recomendação de Roadmap

| Fase                | Objetivo              | Prazo      | Impacto             |
| ------------------- | --------------------- | ---------- | ------------------- |
| **Produção Segura** | Crítico (12 itens)    | Semana 1   | 🔴 Bloqueador       |
| **Robusto**         | Alto (10 itens)       | Semana 2-4 | 🟠 Muito importante |
| **Otimizado**       | Médio (10 itens)      | Mês 2-3    | 🟡 Importante       |
| **Futuro**          | Longo prazo (4 itens) | Roadmap    | 📋 Nice-to-have     |

**Recomendação**: Proceder com **produção após completar items CRÍTICO**. O projeto está em excelente condição técnica; os ajustes finais garantirão maturidade corporativa.
