# Agent Evolution Review And Backlog

## Scope

This review consolidates the recent project-agent evolution work and the latest
delivery changes around targets, reports, exports, Specialist Hunter, Studio
baseline and persistence hardening.

It uses the project flow:

Domain check -> Architecture impact -> Database/source-of-truth check ->
Implementation -> UX Quality Review -> Reuse & Componentization Review ->
Security/RLS Review -> Database Performance Review -> Final Code Review.

## Review Findings

### Domain And Source Of Truth

- The project has converged on normalized annual facts for customer targets,
  person targets, studio allocations, board baselines and Specialist Hunter
  selections.
- `ownAmount` versus current Hunter `amount` is now the key rule preventing
  double counting Studio Hunter.
- Studio Maintenance/Renewal remains operational and should not become Hunter
  target.
- Specialist Hunter is correctly modeled as managerial selection, not an
  official financial target.

Risk:

- Some domain rules still live in several places at once: local repository,
  Supabase adapter, migrations, reports and UI helpers.

### Architecture

- `DeliveryRepository` is a good boundary and should remain the main app
  contract.
- The next architecture step is a backend command/BFF boundary for critical
  writes, while keeping Supabase RPCs/RLS active.
- The future SQL Server migration should be adapter-led, not UI-led.

Risk:

- Browser-side fallback multi-write paths duplicate transactional rules and make
  parity harder.

### UX Quality

- Recent UI changes improved dense operational screens by grouping filters,
  totals and actions.
- Report/export actions are reusable; the official Financial export now reuses
  the app's standard workbook pattern with the official 9-column shape.
- The biggest UX risk is table density in reports and operational screens,
  especially long labels, horizontal scroll and export expectation mismatch.

Risk:

- The "Planilha oficial" button exports a custom shape that users may compare
  against visible table columns; labels and docs need to keep making that
  difference explicit.

### Reuse And Componentization

- Report export behavior is centralized in `ReportExportActions`.
- Several derived target calculations are still repeated across Customers,
  Reports, Baseline comparison and target screens.
- Reuse should be extracted only around proven duplicated financial derivations,
  not as a generic reporting framework.

Risk:

- Premature abstraction could make the financial rules harder to audit.

### Security / RLS

- Supabase RLS, app roles and RPCs enforce critical production rules today.
- Compensation remains sensitive and excluded from broad exports.
- Anti-lock-in work must preserve security equivalence; SQL Server migration
  cannot become "service account does everything" without app-side row/role
  checks and audit.

Risk:

- Direct Supabase Auth coupling in login/report-sensitive UI was reduced by the
  auth service/provider boundary. Admin access RPCs still need an
  `AccessRepository` or server boundary.

### Database Performance

- Current repository loads broad `DeliveryData`, which is acceptable for current
  internal scale but will need focused read models as data volume grows.
- Reports do client-side derivation, which is portable but can become expensive.
- SQL Server readiness should include indexes for year/customer/person/type
  query patterns and command-level transactions.

Risk:

- Migrating without contract tests would make report/dashboard drift likely.

## Backlog

Current status on 2026-07-09:

- Done: official Financial export stabilization, report QA, provider
  abstraction, auth provider boundary with SSO reservation, security hardening,
  pentest-lite, database performance indexes, store consistency fixes and
  report export service extraction.
- Done: `AccessRepository` boundary for admin access RPCs.
- Done: BFF boundary for `savePersonCustomerTargets`, preserving the current
  provider logic and user RLS context.
- Done: BFF boundary for `saveCustomer`, preserving current customer, annual
  target and manager assignment semantics under user RLS context.
- Partially done: repository contract coverage and SQL Server readiness
  documentation.
- Pending: backend command/BFF boundary for `savePerson`, fuller domain
  derivation tests, visual UX screenshot QA, real RLS smoke users and SQL Server
  migration runbook.

### P0 - Stabilize Current Export Work

1. Validate official spreadsheet output after the 9-column layout change.
2. Add/update spec references for the official Financial column shape.
3. Keep the app's richer report rows, including subtotals/totals, in the
   official export unless Financial requests a strict flat template.
4. Run `npm run test:reports` with `typecheck`, `lint`, `build` and smoke when
   report work is complete. The reports QA must generate and inspect the real
   workbook structure, not only scan source text.

### P1 - Persistence And SQL Server Readiness

1. Keep `docs/persistence-contract.md` current whenever persistence behavior
   changes.
2. Add adapter contract tests for `getAll`, `saveCustomer`, `savePerson`,
   `savePersonCustomerTargets`, `saveStudioTargetAllocation` and
   `saveSpecialistHunterStudioAssignments`.
   - Started with an executable local adapter harness for `getAll`,
     `savePersonCustomerTargets` and `saveStudioTargetAllocation`.
3. Extract provider-neutral command names for current Supabase RPCs.
4. Done: create `AccessRepository` and move Supabase access RPC calls out of UI pages.
5. Keep `src/lib/repositories/provider.ts` as the explicit provider factory for
   `supabase`, `local-dev` and `unavailable`; future `sqlserver` wiring should
   start there without changing UI/store contracts.
6. Document SQL Server equivalents for every new migration that adds trigger,
   policy, check, index or RPC behavior.

### P2 - Backend Command Boundary

1. Done: move `savePersonCustomerTargets` behind a Next.js route/server command
   while keeping Supabase/RLS enforcement.
2. Done: move `saveCustomer` manager assignment cleanup behind a backend command.
3. Move `savePerson` assignment replacement behind a backend command.
4. Remove browser fallback multi-write paths only after migrations/RPCs are
   proven present in production.

### P3 - Domain Derivation Reuse

1. Extract shared Hunter effective-person logic from reports/customer screens
   only where two real consumers already match.
2. Extract shared Studio Hunter containment calculations.
3. Add focused tests for no double-counting of own Hunter plus Studio Hunter.
4. Add snapshot-style tests for official report rows and baseline comparison
   rows.

### P4 - UX And Reporting Hardening

1. Add a visible explanation near "Planilha oficial" that it follows the
   Financial columns while preserving the app's richer report structure.
2. Check report tables in desktop and mobile query states for overflow.
3. Add empty-state copy for official export when filters produce zero official
   rows.
4. Review file names for all filtered export combinations.

### P5 - Migration Preparation

1. Create a SQL Server migration runbook draft.
2. Define canonical data export format from Supabase.
3. Define dual-read comparison scripts for Supabase versus SQL Server.
4. Define rollback criteria before any future cutover.
