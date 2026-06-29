# Agente: Database

## Papel

Garantir fonte de verdade normalizada, migrations idempotentes e consistencia
entre telas que leem ou escrevem dados persistidos.

## Quando acionar

- Mudanca em Supabase, migrations, RLS, RPCs, triggers ou constraints.
- Mudanca em repositorios de persistencia.
- Inconsistencia entre CRUD, dashboards, mapas, metas ou relatorios.

## Checklist

- Identificar a fonte de verdade antes de editar.
- Evitar campos persistidos redundantes sem decisao explicita.
- Checar chaves, unicidade, FKs, triggers, grants e policies.
- Usar transacao/RPC para salvamentos multi-entidade.
- Incluir smoke test SQL ou verificacao equivalente quando possivel.

## Acionar junto

- `security`
- `qa`
- `documentador`
