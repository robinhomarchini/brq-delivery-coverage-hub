# Database Portability And Anti-Lock-In Plan

## Objective

Prepare BRQ Delivery Coverage Hub to migrate from Supabase/Postgres to another
persistence backend in the future without rewriting the whole application. The
expected target backend is Microsoft SQL Server.

This is a planning document only. It does not remove Supabase, change production
behavior, bypass RLS/security, or migrate data.

The companion provider-neutral contract is `docs/persistence-contract.md`.

## 1. Current Supabase Coupling Map

### Main application boundary

- `src/lib/repositories/types.ts` defines `DeliveryRepository`; this is already
  the main application persistence boundary.
- `src/store/delivery-store.tsx` chooses `SupabaseDeliveryRepository` when
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist, otherwise
  it uses `localDeliveryRepository` outside production.
- Most product screens consume data through `useDeliveryStore`, which keeps
  normal CRUD and reporting screens mostly independent from Supabase APIs.

### Supabase adapter coupling

- `src/lib/repositories/supabaseDeliveryRepository.ts` imports
  `@supabase/supabase-js`, uses table names directly through `.from(...)`, and
  calls `.rpc(...)`.
- The adapter maps between camelCase domain types and snake_case database rows.
- `fetchAll()` reads many Supabase tables directly and returns a single
  `DeliveryData` graph.
- Several writes are multi-step browser-side sequences when RPC fallback is used,
  especially customer/person assignments, targets, studio allocations and cleanup.

### Local adapter coupling

- `src/lib/repositories/localDeliveryRepository.ts` mirrors much of the domain
  behavior in memory.
- It is valuable as a behavioral reference, but it is not a production-ready
  backend adapter because it has no durable transactions, auth, RLS equivalent,
  audit, concurrency control or server-side authorization.

### RPC usage

Current RPCs are part of the production contract, not just implementation detail:

- `save_person_with_assignments`
- `save_customer_with_managers`
- `save_person_customer_targets`
- `remove_person_customer_targets`
- `save_specialist_hunter_studio_assignments`
- `accept_current_app_access`
- `list_app_access`
- `upsert_app_access`
- `delete_app_access`

These RPCs encode important transaction, access and cleanup rules.

### RLS/RBAC and auth coupling

- Migrations define `app_users`, admin/editor/viewer/hunter_viewer roles,
  `is_active_brq_user()`, `can_edit_delivery_data()`, `is_delivery_admin()` and
  compensation-specific access helpers.
- Policies use Supabase/Postgres primitives such as `auth.uid()`,
  `auth.jwt()`, `auth.users`, grants, `security definer` functions and RLS.
- `src/components/auth/auth-gate.tsx`, `src/components/layout/app-shell.tsx`,
  `src/app/configuracoes/page.tsx`, `src/lib/access-control.ts`,
  `src/lib/access-context.tsx` and `src/lib/supabase/client.ts` are directly
  coupled to Supabase Auth.

### Database-specific SQL

Migrations use Postgres/Supabase-specific features:

- RLS policies, grants and revokes.
- `security definer` functions.
- `auth.uid()`, `auth.jwt()`, `auth.users`.
- Triggers for audit, `updated_at`, creator fields and derived target totals.
- PL/pgSQL functions.
- `pg_advisory_xact_lock`.
- JSON/JSONB audit payloads and snapshot rows.
- Partial/unique indexes and check constraints.

### UI and reporting coupling

- Product UI is mostly coupled to the store/domain arrays rather than Supabase.
- Admin access management is directly coupled to Supabase RPCs.
- Reports, dashboards, exports, baseline comparison and challenge analysis are
  derived client-side from `DeliveryData`.
- This makes read-side portability good, but it also means a future backend must
  reproduce the exact normalized facts and derivation semantics.

## 2. What Is Already Portable

- The `DeliveryRepository` contract is a strong anti-lock-in asset.
- Most screens use `useDeliveryStore` instead of importing Supabase directly.
- Domain calculations live in TypeScript helpers such as customer targets,
  challenge analysis, coverage sync, studio baseline comparison and report
  builders.
- The local repository provides a second implementation of many domain rules.
- Domain types are app-owned in `src/data/mockData.ts` and repository types,
  not generated from Supabase.
- Exports are generated in the browser from domain data, not through database
  export endpoints.
- Production mock fallback is blocked, which avoids accidental non-Supabase
  behavior in production.

## 3. What Is Not Portable

- Auth and access management are Supabase-specific today.
- Critical authorization depends on Postgres RLS and Supabase Auth claims.
- Critical transactions are partly encoded in Postgres RPCs/triggers.
- The Supabase adapter has table names, column names, query shapes and fallback
  multi-write logic inline.
- Some critical business rules are duplicated between local adapter, Supabase
  adapter, migrations and UI helpers.
- Audit depends on Postgres triggers and `auth.uid()`.
- Compensation privacy depends on RLS/policies plus app-level checks.
- Migration history is Supabase CLI/Postgres SQL specific.
- A non-Postgres backend would need equivalents for constraints, unique keys,
  transactional saves, audit, access policies and derived target synchronization.

## 4. Required Abstraction Improvements

### Keep `DeliveryRepository`, split responsibilities behind it

Keep `DeliveryRepository` as the application boundary, but introduce smaller
server-side/domain ports behind it:

- `DeliveryReadRepository`: returns canonical read model or focused read models.
- `PeopleCommandRepository`: person save, lifecycle, assignments.
- `CustomerCommandRepository`: customer save, yearly targets, manager links.
- `TargetCommandRepository`: person targets, studio allocations, specialist
  hunter selections.
- `AccessRepository`: current user, access list and admin changes.
- `AuditRepository`: audit append/read contracts.

The UI should still depend on `DeliveryRepository` or a store facade. The split
is for implementation and tests, not for spreading persistence concerns into UI.

### Move provider-specific auth behind an app-owned session boundary

Create an app-owned auth/access contract:

- `src/server/auth/session.ts`
- `src/server/access/access-service.ts`
- `src/lib/access-control.ts` keeps pure role helpers only.

The contract should expose `AppSession`, `AccessUser`, role checks and admin
commands without leaking `SupabaseClient`, `User`, `auth.uid()` or RPC names.

### Define command contracts for critical writes

Every multi-entity write should have an app command name and payload independent
from RPC names:

- `savePersonWithAssignments`
- `saveCustomerWithManagersAndTargets`
- `savePersonCustomerTargets`
- `removePersonCustomerTargets`
- `saveStudioTargetAllocation`
- `saveSpecialistHunterStudioAssignments`

Supabase can continue implementing these commands through RPCs/triggers. A
future backend can implement the same commands with its own transaction model.

### Add backend/BFF boundary before swapping databases

The next architecture should route production writes through Next.js route
handlers or server actions, then into command repositories/RPCs. Browser code
should not orchestrate critical multi-step writes.

Suggested shape:

```text
src/app/api/delivery/<command>/route.ts
src/server/auth/
src/server/delivery/commands/
src/server/delivery/repositories/
src/lib/repositories/
src/lib/domain/
```

### Create a portable schema/invariant catalog

Document each table and invariant in backend-neutral language:

- entity and relationship ownership;
- unique business keys;
- non-negative financial checks;
- annual/year grain;
- derived/cache fields;
- delete cleanup rules;
- access rule per role;
- audit requirement.

This catalog becomes the acceptance contract for any future database.

## 5. Migration Risks

- Losing RLS-equivalent enforcement if a new backend relies only on UI checks.
- Reimplementing Supabase RPCs incompletely and breaking target reconciliation.
- Losing audit fidelity for sensitive financial/compensation changes.
- Inconsistent reads if a new backend returns denormalized totals that disagree
  with current derived reports.
- Partial writes during person/customer/target changes if transaction boundaries
  are not preserved.
- Auth migration risk: existing `app_users` records link to Supabase `auth.users`
  UUIDs and email lifecycle behavior.
- Policy drift: `viewer`, `hunter_viewer`, `editor`, `admin` must keep the same
  read/write semantics.
- Report/export regressions if read models omit Studio Hunter, maintenance,
  own Hunter amount, board baseline or specialist hunter selection facts.
- Data migration risk around legacy/cache fields such as customer target totals.
- Operational risk because Supabase migrations are currently the executable
  source of database truth.

## 6. Recommended Target Architecture

Use a hexagonal/BFF architecture while keeping Supabase as the current adapter:

```text
UI components
  -> delivery store facade
  -> DeliveryRepository app contract
  -> BFF/API command handlers for writes
  -> domain command services
  -> persistence adapter
       - Supabase/Postgres adapter now
       - future adapter later
```

Read side:

- Keep `DeliveryData` for current screens.
- Add focused read models gradually for heavy dashboards/reports when needed.
- Keep report/export derivations in app-owned TypeScript unless performance
  requires backend read projections.

Write side:

- Critical commands must be atomic behind backend/database boundaries.
- Supabase implementation can keep RPCs.
- Future implementations must provide equivalent transaction, authorization and
  audit guarantees.

Security:

- Treat browser as untrusted.
- Keep RLS while on Supabase.
- Define provider-neutral access checks in server code and enforce them in every
  future adapter.
- Never replace RLS with frontend-only `canEdit` checks.

## 7. Step-By-Step Migration Path

1. Document the current persistence contract and invariants.
   - Add a database-neutral catalog for entities, relationships, constraints,
     commands, access rules and audit rules.

2. Extract Supabase Auth behind app-owned access ports.
   - Keep Supabase implementation.
   - Remove `SupabaseClient` from access-management UI code over time.

3. Introduce command service interfaces behind `DeliveryRepository`.
   - Start with one workflow: `savePersonCustomerTargets`.
   - Keep behavior identical and still call Supabase RPC/fallback internally.

4. Move critical writes from browser orchestration to BFF/API route handlers.
   - Keep Supabase RPCs as the database transaction layer.
   - Return canonical `DeliveryData` reloads or compact invalidation signals.

5. Remove adapter fallback paths for RPCs after verifying migrations are always
   applied in production.
   - Fallback multi-writes are useful for homologation drift but increase
     portability risk because they duplicate transaction rules in browser code.

6. Build contract tests that run against local and Supabase adapters.
   - Same inputs, same domain outputs, same errors for important workflows.

7. Add migration/export tooling for canonical data.
   - Export normalized tables plus audit/access mapping.
   - Include verification queries for totals and relationships.

8. Build a prototype SQL Server adapter in non-production.
   - Start read-only with `getAll()`.
   - Then implement one command at a time.
   - Do not switch production until command parity, auth parity, audit parity and
     report parity pass.

9. Run dual-read comparison before any real migration.
   - Same production snapshot loaded into Supabase and SQL Server.
   - Compare dashboard totals, customer totals, person targets, reports,
     baseline comparisons and exports.

10. Cut over only after security equivalence is proven.
    - Auth, authorization, audit, transactions and rollback path must be
      documented and tested.

## 8. Backlog Of Small Safe Tasks

1. Create `docs/persistence-contract.md` with table/entity ownership,
   invariants, access rules and command semantics.
2. Add `src/lib/repositories/contract-tests/` with adapter-independent test
   scenarios for `getAll`, customer save, person save, person targets, studio
   allocations and specialist hunter selections.
3. Extract pure row mapping functions from `supabaseDeliveryRepository.ts` into
   a provider-specific mapper file.
4. Extract `AccessRepository` interface and a `SupabaseAccessRepository`.
5. Replace direct Supabase access calls in `src/app/configuracoes/page.tsx` with
   the access repository/service.
6. Keep `src/lib/repositories/provider.ts` as the single persistence provider
   factory and extend it only through explicit providers.
7. Add command interfaces for target-related writes and implement them with the
   current Supabase adapter first.
8. Move `savePersonCustomerTargets` behind a Next.js route handler while keeping
   the current Supabase RPC/database enforcement.
9. Move `saveCustomer` manager/target orchestration behind a backend command.
10. Move `savePerson` assignment orchestration behind a backend command.
11. Add read-model snapshot tests for dashboard totals, baseline comparison,
    Relatório de Metas and export rows.
12. Document every Supabase RPC with a provider-neutral command equivalent.
13. Add a data export/import runbook for canonical tables and access mappings.
14. Add RLS/security smoke tests that can later become provider-neutral
    authorization contract tests.
15. Review and minimize legacy/cache fields once all reports read normalized
    annual facts consistently.

## Files To Inspect Or Change, Suggested Order

### Planning and documentation

1. `docs/persistence-contract.md` - create first.
2. `docs/project/ARCHITECTURE.md` - update with BFF/command boundary.
3. `docs/project/DOMAIN_MODEL.md` and `docs/project/BUSINESS_RULES.md` - keep invariants in
   provider-neutral language.
4. `docs/runbooks/supabase-migration-history.md` - keep Supabase-specific
   operations isolated as current-provider runbook.

### Application boundaries

5. `src/lib/repositories/types.ts` - preserve `DeliveryRepository`; add command
   and access ports only when needed.
6. `src/store/delivery-store.tsx` - keep UI facade stable; later point writes to
   BFF-backed repository methods.
7. `src/lib/repositories/provider.ts` - current provider factory for
   `supabase`, `local-dev` and `unavailable`; future SQL Server wiring should
   start here.
8. `src/lib/repositories/localDeliveryRepository.ts` - use as contract-test
   implementation, not production fallback.
9. `src/lib/repositories/supabaseDeliveryRepository.ts` - split mapper, read
   adapter and command adapter incrementally.

### Auth and access

10. `src/lib/supabase/client.ts` - isolate provider creation.
11. `src/lib/access-control.ts` - keep pure helpers; move Supabase calls out.
12. `src/lib/access-context.tsx`, `src/components/auth/auth-gate.tsx`,
    `src/app/configuracoes/page.tsx`, `src/components/layout/app-shell.tsx` -
    replace direct Supabase coupling after an access port exists.

### Backend command layer

13. `src/app/api/delivery/**/route.ts` - add command routes gradually.
14. `src/server/auth/**` - provider-neutral session and authorization.
15. `src/server/delivery/commands/**` - transaction-oriented command services.
16. `src/server/delivery/repositories/**` - provider adapters used by commands.

### Database/provider implementation

17. `supabase/migrations/` - keep as current Supabase implementation; do not
    remove RLS/RPC/triggers until an equivalent backend is proven.
18. Future provider folder, for example `src/server/delivery/repositories/<new-provider>/`.

### Reports and exports

19. `src/components/reports/person-target-report.tsx`
20. `src/components/dashboard/executive-dashboard.tsx`
21. `src/components/insights/baseline-comparison.tsx`
22. `src/components/executive/challenge-analysis.tsx`
23. `src/lib/export.ts`

These should remain read-model consumers. Change them only if a future backend
introduces explicit read projections with the same semantics.
