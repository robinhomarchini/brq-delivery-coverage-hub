# Production Readiness

## Status atual

O projeto está adequado para homologação interna controlada. Para produção
corporativa definitiva, ainda deve concluir a migração para BFF/API ou Server
Actions, endurecer RLS por perfil e separar metas financeiras de campos
operacionais de cliente.

## Guardrails aplicados

- Autenticação Supabase com e-mail corporativo.
- Headers mínimos de segurança.
- RLS habilitado nas tabelas de domínio.
- Relação Pessoa ↔ Cliente normalizada.
- Metas editáveis normalizadas por pessoa/cliente/tipo/ano.
- Produção sem Supabase configurado não abre mock local.
- RPCs transacionais disponíveis para operações críticas após migration.

## Próximos hardenings recomendados

1. Trocar policy ampla de homologação por viewer/editor/admin estrito.
2. Mover leituras e escritas críticas para BFF/API Routes.
3. Criar `customer_targets` para separar meta total de `customers.revenue`.
4. Adicionar testes automatizados de autorização e reconciliação.
5. Adicionar observabilidade de erros e auditoria visível no produto.

## Checklist de release

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Migrations aplicadas no Supabase correto.
- Smoke test de login BRQ.
- Smoke test de salvar Pessoa, Cliente e Metas.
- Verificação de exportações.
- Plano de rollback da Vercel identificado.
