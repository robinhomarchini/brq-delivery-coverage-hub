# Plano técnico — Hardening Arquitetural

## Decisão de arquitetura

O primeiro corte usa RPCs Postgres transacionais para operações críticas. Isso
reduz risco de escrita parcial sem exigir uma migração completa imediata para
BFF/API Routes.

O target final permanece:

```text
Frontend React/Next.js
  -> BFF / Server Actions / API Routes
    -> Domain services
      -> Supabase RPCs / Postgres
```

## Fonte de verdade

- Pessoa ↔ Cliente: `person_customer_assignments`.
- Metas editáveis: `revenue_target_allocations`.
- Cliente: identidade/governança em `customers`.
- Meta total atual do cliente: temporariamente `customers.revenue`, com evolução
  futura recomendada para `customer_targets`.

## Transações

Adicionar RPCs:

- `save_person_with_assignments`
- `save_customer_with_managers`
- `save_person_customer_targets`

A RPC de metas usa lock transacional por cliente/ano para evitar corrida entre
duas edições simultâneas.

## Segurança

- RPCs verificam permissão de edição por helper central.
- Auditoria é adicionada às tabelas normalizadas.
- Homologação ampla por e-mail BRQ permanece temporariamente documentada.

## Validação

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Smoke tests SQL incluídos na migration.
