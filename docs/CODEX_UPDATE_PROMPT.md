# Prompt para Atualizar Codex — Avaliação Técnica 2026-07-14

## Contexto

Uma avaliação técnica completa foi realizada na aplicação BRQ Delivery Coverage Hub. Foram identificadas:

- **12 incidentes críticos de segurança e DevOps**
- **7 gaps de arquitetura**
- **8 gaps de testes**
- **5 gaps de performance**

## Tarefa

Integre as descobertas, recomendações e padrões identificados ao Codex, de forma que:

1. **Agents futuros entendam os padrões já estabelecidos** (adapter pattern, BFF, RLS, etc.)
2. **Regras de qualidade sejam automáticas em toda mudança** (CSP, migrations, .env, tests)
3. **Review lenses especializadas bloqueiem regressões** (security, performance, scalability)
4. **Documentação de runbooks e checklists guiem qualquer novo trabalho**

## Alterações Propostas

### 1. Adicionar Seção "Security & Production Readiness Gates" ao AGENTS.md

```markdown
## Security & Production Readiness Gates

**OBRIGATÓRIO** para qualquer mudança que toque:

- Autenticação, autorização, RLS
- Migrations, schema, constraints
- APIs/rotas sensíveis
- Configurações de ambiente
- CSP, headers, secrets

### Checklist de Segurança

- [ ] **CSP nunca usa `unsafe-inline`** (exceto `style-src` e `unsafe-inline` em dev)
  - script-src deve usar nonce em produção
  - Validar em `next.config.ts`

- [ ] **Dados de teste NUNCA estão hardcoded em migrations**
  - Grep: `robinson.marchini|acoelho|INSERT INTO|test@|demo@`
  - Usar `npm run security:check` antes de push

- [ ] **Segredos não expõem em `.env.example`**
  - `SUPABASE_SERVICE_ROLE_KEY` deve ter comentário SECURITY WARNING
  - Senhas/tokens devem estar APENAS em `.env.local`
  - `.env.local` sempre em `.gitignore`

- [ ] **Supabase Auth: sign-up desativado em produção**
  - Se sign-up habilitado, qualquer @brq.com pode entrar
  - Documentar em PRODUCTION_READINESS.md

- [ ] **BFF requerido para operações sensíveis**
  - `savePerson`, `saveArea`, `saveSubject` devem ter POST `/api/delivery/[entity]`
  - Validar session, papel, RLS no servidor
  - Não enviar requests direto Supabase do browser

- [ ] **Rate limiting em `/api/delivery/*`**
  - Previne DoS mesmo de usuários autenticados
  - Usar `@upstash/ratelimit` ou middleware customizado

- [ ] **Migrations com validação RLS**
  - `npm run db:migrations:check` deve passar
  - Policies devem estar explícitas, não genéricas
  - SECURITY DEFINER em RPCs sensíveis

### Review Lenses para Security

1. **CSP Reviewer**: valida `next.config.ts` não tem `unsafe-inline` em script-src
2. **Secrets Reviewer**: grep `.env.example`, `.env.production`, migrations por tokens/credentials
3. **RLS Reviewer**: valida que `is_active_brq_user()`, `can_edit_delivery_data()`, `is_delivery_admin()` existem
4. **BFF Reviewer**: valida que operações de escrita têm BFF antes de chegar no banco
5. **Migration Reviewer**: valida `npm run db:migrations:check` passa, sem dados hardcoded
```

### 2. Criar Arquivo `.squad/security-gates.yaml`

```yaml
# Security Gates — Automatizar em CI/CD

gates:
  # Bloqueadores críticos
  csp_policy:
    rule: "script-src must not contain 'unsafe-inline' in production"
    check: |
      grep -r "unsafe-inline" next.config.ts |
      grep -v "dev-only\|'unsafe-inline'${isProduction ? \"\" : " 'unsafe-eval'}"
    fail_message: "CSP script-src violação! Usar nonce em produção."
    run_on: every_commit_to_main

  hardcoded_test_data:
    rule: "No hardcoded user emails/credentials in migrations"
    check: |
      grep -r "robinson.marchini\|acoelho\|test@\|demo@" supabase/migrations/
    fail_message: "Dados de teste detectados em migrations! Remover antes de push."
    run_on: every_commit_to_main

  service_role_exposure:
    rule: "SUPABASE_SERVICE_ROLE_KEY never in .env.example or .env.production"
    check: |
      grep "SUPABASE_SERVICE_ROLE_KEY=" .env.example .env.production || true
    fail_message: "SERVICE_ROLE_KEY exposto! Remover de .env.example."
    run_on: every_commit_to_main

  env_local_gitignore:
    rule: ".env.local must be in .gitignore"
    check: |
      grep ".env.local" .gitignore || (echo "Missing .env.local in .gitignore"; exit 1)
    fail_message: ".env.local não está em .gitignore! Adicionar."
    run_on: every_commit

  build_includes_tests:
    rule: "npm run build must run lint, typecheck, and test:contracts"
    check: |
      grep "lint && npm run typecheck && npm run test:contracts" package.json
    fail_message: "Build script não inclui tests! Atualizar package.json."
    run_on: every_push_to_production

  rls_validations:
    rule: "npm run db:migrations:check must pass"
    command: "npm run db:migrations:check"
    fail_message: "RLS/migrations check falhou! Revisar schema."
    run_on: every_migration

  security_check:
    rule: "npm run security:check must pass"
    command: "npm run security:check"
    fail_message: "Security check falhou! Revisar hardening."
    run_on: every_commit_to_main
```

### 3. Adicionar Seção "Incident Prevention" ao AGENTS.md

```markdown
## Incident Prevention — Lessons from 2026-07-14

### 1. CSP unsafe-inline Incident

- **Root cause**: Script-src usava `'unsafe-inline'` permitindo XSS direto
- **Prevention**:
  - CSP deve ser computada com nonce por request
  - next.config.ts nunca deve ter `unsafe-inline` em script-src produção
  - Review lens obrigatório em qualquer mudança de CSP

### 2. Hardcoded Test Data Incident

- **Root cause**: Emails e dados de teste foram commitados em migrations
- **Prevention**:
  - grep migrations antes de commit: `robinson.marchini|acoelho|test@|demo@`
  - Usar variáveis de ambiente para seed data
  - CI/CD bloqueia commits com dados sensíveis

### 3. Secrets Exposure Incident

- **Root cause**: SUPABASE_SERVICE_ROLE_KEY estava em .env.example comentado
- **Prevention**:
  - NUNCA colocar SERVICE_ROLE_KEY em .env.example
  - Adicionar SECURITY WARNING em comentários de .env.example
  - CI/CD escaneia .env\* por tokens/credentials

### 4. Missing BFF for Sensitive Operations

- **Root cause**: savePerson() chamava Supabase direto do browser
- **Prevention**:
  - Todas operações de escrita devem ter BFF (/api/delivery/\*)
  - BFF valida session + papel + RLS antes de chamar banco
  - Review lens: "Não há operação sensível falando direto com Supabase"

### 5. Incomplete CI/CD

- **Root cause**: Deploy era manual, sem validação automática
- **Prevention**:
  - GitHub Actions obrigatório em main branch
  - Pipeline: lint → typecheck → test:contracts → build → deploy
  - Rollback plan documentado

### 6. Missing Rate Limiting

- **Root cause**: Usuários autenticados podiam fazer DoS
- **Prevention**:
  - `/api/delivery/*` deve ter rate limiting
  - Usar @upstash/ratelimit ou middleware

### 7. Missing Pagination

- **Root cause**: getAll() carregava 10k+ registros bloqueando UI
- **Prevention**:
  - DeliveryRepository.getAll() deve suportar { limit, offset }
  - Store deve usar lazy loading
  - Performance test bloqueia mudanças que reintroduzem full load

### 8. Untested RLS Changes

- **Root cause**: Migration de RLS passou sem testes automatizados
- **Prevention**:
  - `npm run smoke:rls` obrigatório antes de deploy
  - Docker Postgres container para testes locais
  - CI/CD roda smoke RLS com usuários dedicados
```

### 4. Aprimorar `.squad/memory.md` com Padrões de Qualidade

Adicionar seção permanente:

````markdown
## Established Patterns & Anti-Patterns (2026-07-14)

### Security Anti-Patterns to Block

❌ **Never**:

- Use `unsafe-inline` em `script-src` CSP
- Hardcode user emails, credentials, ou dados de teste em migrations
- Expor `SUPABASE_SERVICE_ROLE_KEY` em .env.example, .env.production, ou versionado
- Chamar Supabase direto do browser para operações sensíveis (sem BFF)
- Deixar `.env.local` sem .gitignore
- Deploy sem `npm run security:check` passando

### Performance Anti-Patterns to Block

❌ **Never**:

- getAll() sem paginação em tabelas >100 registros
- Componentes >500 linhas sem extração
- Full re-render em Store Context sem memoização
- Lazy loading de componentes pesados sem Suspense

### Architecture Anti-Patterns to Block

❌ **Never**:

- Hardcode operational data (pessoas, clientes, managers, hunters, áreas) em UI
- Duplicar business rules apenas em UI (deve estar em repo/API/RPC/RLS)
- Usar string queries em Supabase sem type-safe builder

### Quality Gates Obrigatórias

✅ **Sempre executar antes de push**:

```bash
npm run lint           # ESLint
npm run typecheck      # TypeScript strict
npm run test:contracts # Repository contract
npm run security:check # CSP, secrets, RLS
npm run build          # Next.js build (inclui tudo acima)
npm run smoke:critical # Fluxos críticos (customer-hunter, targets)
```
````

✅ **Antes de deploy para produção**:

```bash
npm run db:migrations:check  # Valida RLS/migrations
npm run test:performance     # Memoização, índices
npm run security:pentest-lite # Pentest contra URL
npm run smoke:rls            # RLS com perfis reais
```

````

### 5. Criar GitHub Actions Workflow

Arquivo: `.github/workflows/security-quality-gate.yml`

```yaml
name: Security & Quality Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check CSP
        run: |
          if grep -r "script-src.*unsafe-inline" next.config.ts; then
            echo "❌ CSP script-src contains unsafe-inline"
            exit 1
          fi
      - name: Check Hardcoded Test Data
        run: |
          if grep -r "robinson.marchini\|acoelho\|test@brq" supabase/migrations/; then
            echo "❌ Hardcoded test data found in migrations"
            exit 1
          fi
      - name: Check SERVICE_ROLE_KEY Exposure
        run: |
          if grep -E "SUPABASE_SERVICE_ROLE_KEY=" .env.example .env.production 2>/dev/null; then
            echo "❌ SERVICE_ROLE_KEY exposed in .env.example or .env.production"
            exit 1
          fi

  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:contracts
      - run: npm run build
      - run: npm run security:check
````

---

## Como Usar Este Prompt

1. **Copie este documento** para sua base de conhecimento do Codex
2. **Atualize AGENTS.md** com as seções de Security Gates e Incident Prevention
3. **Crie .squad/security-gates.yaml** com as verificações automáticas
4. **Atualize .squad/memory.md** com patterns/anti-patterns
5. **Crie GitHub Actions workflow** para CI/CD automático
6. **Instrua agents**: "Antes de qualquer mudança, consulte AGENTS.md → Security Gates"

Isso garante que:

- ✅ Novos agents entendem os padrões estabelecidos
- ✅ Regressões são bloqueadas automaticamente
- ✅ Security reviews são obrigatórias
- ✅ Performance gates impedem degradação
- ✅ DevOps é automatizado

---

## Relacionado

- [TECHNICAL_QUALITY_ASSESSMENT.md](docs/TECHNICAL_QUALITY_ASSESSMENT.md) — Avaliação completa
- [AGENTS.md](AGENTS.md) — Instruções principais do projeto
- [.squad/config.yaml](.squad/config.yaml) — Configurações do Virtual Squad
- [.squad/memory.md](.squad/memory.md) — Memória compartilhada do squad
