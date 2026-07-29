# Employee Import — Batch Lifecycle and Business Rules

Date: 2026-07-29
Scope: `src/server/employee-import/*`, `src/app/api/admin/employee-import/*`, `src/app/importacao-funcionarios/page.tsx`, employee import RPCs/migrations

## Batch Lifecycle

Confirmed states:
- `reconciling`: created after successful workbook analysis and persistence. User may still adjust manager mappings and retake the batch.
- `applying`: transient server-side state. Marks that an apply operation started. Used to serialize concurrent apply attempts.
- `hc_confirmed`: final applied state. Salaries and headcount have been committed. No further automatic mutations are allowed.

Optional extension if needed:
- `failed`: records a terminal failure without changing database state.

## Valid Transitions

1. `reconciling` -> `reconciling`
   - Headcount-only confirmations without new mappings may refresh metadata but do not advance the state.
2. `reconciling` -> `applying` -> `hc_confirmed`
   - Normal successful application path.
3. Any state can be observed/replayed through preview/history routes, but mutation should require server-side eligibility.

## Business Rules and Authorization Sources

- Business authorization is derived server-side from app access role + `public.can_manage_person_compensation()`.
- Manager mappings are reconciled server-side from `employee_import_manager_mappings` or supplied explicit mappings; frontend mapping data is convenience input only.
- Salary values in `person_compensations.annual_salary` are annual compensation.
- Inactive people rows may be updated if they remain canonical in `people`.
- Unchanged salary rows are ignored.
- Already applied batches remain replayable at the database level through idempotent RPCs, but applications should prevent duplicate UI-triggered applies.

## Atomicity Requirement

- Either salary updates and headcount updates both commit, or none persist.
- The server-side RPC owns the source of truth for pending changes; client snapshots must not decide update scope.
