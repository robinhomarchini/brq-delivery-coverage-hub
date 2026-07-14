# Security & Quality Framework — Agent Guide

## Overview

Este documento descreve como agents e desenvolvedores devem usar o framework de segurança e qualidade para evitar regressões identificadas na avaliação técnica de 2026-07-14.

## Arquivos Centrais

1. **AGENTS.md** — Instruções principais do projeto
   - Seção "Security & Production Readiness Gates" (nova)
   - Seção "Incident Prevention — Lessons from 2026-07-14" (nova)
   - Review lenses obrigatórias para segurança

2. **.squad/security-gates.yaml** (novo)
   - Configuração de gates automáticas
   - Quando rodar cada gate (commit, push, deploy)
   - Integração com CI/CD

3. **.squad/memory.md** (atualizado)
   - Seção "Quality Patterns & Anti-Patterns"
   - Patterns estabelecidos a preservar
   - Anti-patterns a bloquear
   - Incident lessons

4. **.github/workflows/security-quality-gate.yml** (novo)
   - GitHub Actions CI/CD automático
   - Security checks, quality checks, PR validation

## Workflow Para Agents

### Antes de Qualquer Mudança

1. **Leia AGENTS.md**

   ```
   Especialmente:
   - Security & Production Readiness Gates
   - Incident Prevention section
   - Review Lenses for Security
   ```

2. **Consulte .squad/memory.md**

   ```
   Procure padrões estabelecidos e anti-padrões
   para não reintroduzir problemas anteriores
   ```

3. **Inspecione .squad/config.yaml**
   ```
   Entenda o contexto do projeto, stack, conventions
   ```

### Durante Implementation

#### Para Changes de Segurança

- ✅ Valide headers estáticos em `next.config.ts`; CSP só pode ser alterada com smoke real de navegador/hidratação
- ✅ Nenhum hardcoded data em migrations
- ✅ Nenhum secret em `.env.example` ou versionado
- ✅ BFF para operações sensíveis (sempre via `/api/delivery/*`)
- ✅ RLS validado com `npm run db:migrations:check`

#### Para Changes de Performance

- ✅ Componentes <500 linhas (extrair view models)
- ✅ Store com paginação (`limit`, `offset`)
- ✅ Memoização em cálculos derivados (`useMemo`, indexed lookups)
- ✅ Sem lazy loading sem `<Suspense>`

#### Para Changes de Arquitetura

- ✅ Mantenha adapter pattern (DeliveryRepository agnóstico)
- ✅ Nenhum hardcode de dados operacionais na UI
- ✅ Business rules em repo/API/RPC/RLS, não apenas UI
- ✅ Validação em cascata: cliente → BFF → banco

### Antes de Push

Sempre execute:

```bash
npm run lint              # ESLint
npm run typecheck         # TypeScript strict
npm run test:contracts    # Repository contract
npm run security:check    # CSP, secrets, RLS, audit
npm run build             # Executa lint, typecheck, contratos e build
npm run smoke:critical    # Fluxos críticos
```

**Não faça push se algum comando falhar.**

### Antes de Deploy para Produção

Execute adicionalmente:

```bash
npm run db:migrations:check   # Valida RLS/migrations
npm run test:performance      # Memoização, índices, paginação
npm run smoke:rls             # RLS com perfis reais (viewer/editor/admin/blocked)
npm run security:pentest-lite # Pentest contra URL
```

## Checklist de Segurança — Cópia Rápida

Para copiar e preencher ao fazer review/handoff:

```markdown
## Security Checklist

- [ ] CSP script-src: sem `unsafe-inline` em produção
- [ ] Migrations: nenhum hardcoded data de teste
- [ ] .env: `SERVICE_ROLE_KEY` não exposto em exemplo
- [ ] .gitignore: `.env.local` está listado
- [ ] BFF: operações sensíveis têm `/api/delivery/*` correspondente
- [ ] Rate limiting: `/api/delivery/*` protegido
- [ ] RLS: `npm run db:migrations:check` passa
- [ ] Tests: `npm run security:check` passa
- [ ] Build: `npm run build` passa (inclui tudo acima)
```

## Anti-Patterns a Bloquear

Se encontrar um destes padrões, **faça rollback imediatamente**:

```javascript
// ❌ NUNCA: unsafe-inline em script-src produção
"script-src 'self' 'unsafe-inline'" // SEM guards isProduction

// ❌ NUNCA: dados de teste em migrations
INSERT INTO app_users VALUES ('robinson.marchini@brq.com', 'admin');

// ❌ NUNCA: secrets em .env.example
SUPABASE_SERVICE_ROLE_KEY=eyJ...

// ❌ NUNCA: operação sensível sem BFF
const data = await repository.savePerson(person); // browser → Supabase direto

// ❌ NUNCA: getAll sem paginação
async function getAll() {
  return client.from("people").select("*"); // carrega 10k+ registros
}

// ❌ NUNCA: componente >500 linhas sem extração
export function CustomerManagement() {
  // 800 linhas de CRUD, filtros, tabela, cálculos...
}

// ❌ NUNCA: hardcode dados operacionais
const defaultHunter = "robinson.marchini"; // UI nunca codifica!

// ❌ NUNCA: duplicar lógica em UI vs banco
// UI faz validação, banco não faz (ou vice-versa)
```

## Troubleshooting

### "npm run security:check falha"

**Causas Comuns**:

1. CSP tem `unsafe-inline` → Planejar remoção com smoke real de navegador; não publicar nonce sem validar scripts renderizados
2. Migration tem dados hardcoded → Remover ou usar variáveis
3. `.env.example` expõe secrets → Remover, adicionar SECURITY WARNING
4. `npm audit` falhou → Usar `npm audit fix --force` com cuidado

### "npm run test:contracts falha"

**Causas Comuns**:

1. LocalDeliveryRepository não implementa interface completa → Completar método
2. SupabaseDeliveryRepository não bate com Local → Sincronizar assinatura
3. Novo método em DeliveryRepository não testado → Adicionar teste em contract-tests

### "npm run db:migrations:check falha"

**Causas Comuns**:

1. Política RLS genérica (não explícita) → Criar policy explícita por papel
2. Forward reference em constraint → Reordenar migrations
3. Sem SECURITY DEFINER em RPC sensível → Adicionar

### "CSP bloqueia meu script"

**Solução**:

1. Confirme no HTML renderizado se os scripts do Next recebem nonce compatível
2. Confirme console/rede no navegador, não apenas status HTTP 200
3. Mantenha `next.config.ts` apenas com headers estáticos de segurança até existir smoke automatizado de hidratação

## Relacionado

- [AGENTS.md](../../AGENTS.md) — Instruções principais
- [.squad/security-gates.yaml](../.squad/security-gates.yaml) — Gates automáticas
- [.squad/memory.md](.squad/memory.md) — Padrões estabelecidos
- [.github/workflows/security-quality-gate.yml](.github/workflows/security-quality-gate.yml) — CI/CD automático
- [TECHNICAL_QUALITY_ASSESSMENT.md](../../docs/TECHNICAL_QUALITY_ASSESSMENT.md) — Avaliação completa (2026-07-14)
- [CODEX_UPDATE_PROMPT.md](../../docs/CODEX_UPDATE_PROMPT.md) — Prompt para Codex

## Perguntas Frequentes (FAQ)

**P: Posso ignorar um security gate?**
R: NÃO. Todos os gates críticos devem passar. Se houver exceção legítima, documente em AGENTS.md com justificativa.

**P: E se a mudança "é urgente" e não dá tempo para rodar tests?**
R: Rodá-los de qualquer forma. A urgência não elimina riscos de segurança. Se realmente crítico, rodar após review vs antes.

**P: Como adiciono novo gate?**
R: Edite `.squad/security-gates.yaml`, adicione entrada com `name`, `rule`, `check`, `fail_message`, `severity`, `run_on`.

**P: Como faço hotfix em produção?**
R: Mesmo processo. Crie branch, rode todos os gates (inclusive `npm run smoke:rls`), PR, CI/CD automático valida, deploy.

**P: E se GitHub Actions falhar por timeout?**
R: Rerun o workflow. Se falhar 2x, investigar. Não fazer push local desabilitando checks.

## Contato/Escalação

Se encontrar situação não coberta por este guide:

1. Consulte [AGENTS.md](../../AGENTS.md) → Security & Production Readiness Gates
2. Verifique [.squad/memory.md](.squad/memory.md) → padrões/anti-patterns
3. Se ainda incerto, escalue para Tech Lead (Codex) com contexto completo

---

**Última atualização**: 2026-07-14
**Versão**: 1.0
**Autoria**: Technical Quality Assessment
