# Persistence Contract

## Purpose

This document defines the provider-neutral persistence contract for BRQ Delivery
Coverage Hub. Supabase/Postgres remains the current production implementation.
The expected future migration target is Microsoft SQL Server, so new work should
avoid adding Supabase-only assumptions outside provider adapters, migrations and
runbooks.

This contract does not migrate data, remove Supabase, weaken RLS/security, or
change production behavior.

## Application Boundary

`DeliveryRepository` in `src/lib/repositories/types.ts` is the application
persistence boundary. UI, dashboards, reports and exports should consume the
store/repository model instead of using provider clients, SQL, table names, RPC
names or auth provider types.

Provider implementations may use SQL tables, procedures, APIs, documents or
queues internally, but they must expose the same domain data and command
semantics.

## Current Canonical Read Model

`DeliveryData` is the current read model:

- `people`
- `personCompensations`
- `customers`
- `customerTargets`
- `subjects`
- `areas`
- `areaUsages`
- `targetAllocations`
- `studioTargetAllocations`
- `specialistHunterStudioAssignments`
- `boardTargetBaselines`
- `studioBaselineSnapshots`

Future SQL Server read models may be more focused, but they must preserve these
semantics until each consumer is intentionally migrated.

## Entity Contract

### People

Source of truth for organization members, roles, hierarchy, lifecycle, area and
portfolio projection.

Required invariants:

- Role type is a documented domain enum.
- `Hunter Especializado`, Executive, Director and Staff do not receive direct
  revenue targets.
- Lifecycle values are valid and closed people keep enough history for reports.
- Operational people lists come from persisted data, not hardcoded UI lists.

SQL Server equivalent:

- lookup/check constraint for roles and lifecycle;
- foreign keys for director, manager and area references;
- command/procedure validation for target assignability.

### Person Compensation

Sensitive annual compensation facts.

Required invariants:

- Salary is non-negative.
- Currency is currently BRL.
- Broad exports exclude compensation.
- Read/write requires stricter authorization than normal delivery data.
- Writes are audited.

SQL Server equivalent:

- table-level permission through application service or row-filtering strategy;
- check constraints;
- audit table or temporal/audit trigger.

### Customers

Source of truth for customer identity, governance, strategic flags and
compatibility target display fields.

Required invariants:

- Normalized customer names are unique.
- Customer yearly target facts live in `customerTargets`.
- Board baseline facts are separate and must not be overwritten by operational
  edits.
- Customer save plus manager assignment cleanup is transactional.

SQL Server equivalent:

- persisted normalized-name column or unique indexed computed column;
- foreign keys for responsible people;
- stored procedure or application transaction for customer save workflows.

### Customer Targets

Annual operational target facts by customer and year.

Required invariants:

- Unique by customer and year.
- Hunter, Renewal/Amplification and Studio values are non-negative.
- Total/revenue is derived from annual facts or maintained as a consistent cache.

SQL Server equivalent:

- unique index on `(customer_id, target_year)`;
- check constraints for non-negative values;
- transaction-safe update path.

### Person Customer Assignments

Canonical relationship between people and customers.

Required invariants:

- Unique by person and customer.
- Legacy arrays such as `clientIds` are projections.
- Removing manager responsibility cleans dependent Renewal/Amplification targets
  when the workflow owns those targets.
- Direct/principal Hunter semantics must remain distinguishable from additional
  participants where reports require it.

SQL Server equivalent:

- relationship table with unique index;
- source/role metadata where needed;
- transactional replacement commands.

### Target Allocations

Direct annual target facts by customer, person, type and year.

Required invariants:

- Unique by customer, person, target type and year.
- Values are non-negative.
- Hunter `ownAmount` is editable own Hunter target.
- Hunter `amount` is current Hunter total: own Hunter plus Studio Hunter for the
  same customer, person and year.
- Farmer/Renewal `ownAmount` is editable own Renewal/Amplification target when
  present.
- Farmer/Renewal `amount` is current Renewal/Amplification total: own Renewal
  plus eligible Studio Maintenance/Renewal for the same customer, person and
  year. Studio PX is excluded from this rollup.
- Studio Hunter is not double-counted as a second Hunter target.
- New studio facts belong in `studioTargetAllocations`, not direct `studio`
  target allocations.

SQL Server equivalent:

- unique index on `(customer_id, person_id, target_type, target_year)`;
- check constraints;
- trigger, computed refresh procedure or command transaction to keep Hunter
  current total consistent.

### Studio Target Allocations

Annual Studio Hunter and Studio Maintenance/Renewal facts by customer, area,
optional hunter and year.

Required invariants:

- Unique by customer, area/studio, effective hunter key and year.
- Values are non-negative.
- Studio Hunter composes Hunter analysis without double counting.
- Studio Maintenance/Renewal does not become Hunter target.
- Studio Maintenance/Renewal composes Farmer/Delivery Renewal targets when the
  associated person has an eligible Farmer/Delivery role and the Studio is not
  PX.
- Saving/deleting Studio Hunter or eligible Studio Maintenance/Renewal refreshes
  affected person current totals.

SQL Server equivalent:

- unique filtered indexes or normalized nullable-key strategy for unassigned
  hunter;
- check constraints;
- command transaction or trigger for Hunter total refresh.

### Specialist Hunter Studio Assignments

Managerial selections of studio allocation rows for `Hunter Especializado`.

Required invariants:

- Person must have role `Hunter Especializado`.
- Selection is unique by specialist person and studio allocation.
- Replacement by person, customer and year is atomic.
- Assignments do not alter official customer/person/dashboard totals.

SQL Server equivalent:

- foreign keys and unique index;
- stored procedure or application transaction for replace-all command;
- role validation in command layer.

### Board Target Baselines

Approved annual board reference facts.

Required invariants:

- Unique by year, scenario and customer name.
- Operational edits never overwrite board baselines.
- Admin-only management.
- Values are non-negative and audited.

SQL Server equivalent:

- unique index;
- check constraints;
- admin command authorization;
- audit table.

### Studio Baseline Snapshots

Immutable saved comparison snapshots.

Required invariants:

- Snapshot save does not change operational facts.
- Normal users should not update/delete existing snapshots.
- Editor/admin can create snapshots.
- Creator and timestamp are captured where possible.

SQL Server equivalent:

- append-only table or update/delete blocked through command permissions;
- JSON storage or normalized snapshot row storage;
- audit metadata.

### App Access Users

Application-level authorization independent from storage provider.

Application boundary:

- `AccessRepository` in `src/lib/repositories/accessRepository.ts`.
- UI must not call Supabase access RPCs directly.
- The current Supabase implementation remains authoritative through RPCs, RLS
  and RBAC.

Roles:

- `viewer`
- `hunter_viewer`
- `editor`
- `admin`

Required invariants:

- Only corporate `@brq.com` users can become active app users.
- `hunter_viewer` is read-only and scoped.
- `editor` manages normal delivery data.
- `admin` manages access and privileged configuration.
- At least one active admin should remain.

SQL Server equivalent:

- app-owned access table keyed by provider identity and email;
- access commands in backend/service layer;
- no browser exposure of privileged credentials.

## Command Contract

Commands must be atomic when partial success would leave inconsistent data.
Authorization must be enforced server-side and/or database-side, not only by UI.

- `getAll`: returns current read model filtered by access and sensitivity.
- `saveArea` / `deleteArea`: validate, authorize, audit and preserve dependent
  cleanup rules.
- `savePerson`: saves profile, lifecycle and assignments transactionally.
- `savePersonCompensation` / `deletePersonCompensation`: enforce sensitive
  authorization and audit.
- `saveCustomer`: browser callers must go through `/api/delivery/customers`.
  The command validates the bearer token, app access and editor/admin role
  server-side, then saves customer, yearly target context and manager
  assignments transactionally under the current provider/RLS context.
- `saveCustomers`: bulk operational target/customer update, idempotent and not
  allowed to overwrite board baselines.
- `deleteCustomer`: blocks or cleans dependent subjects, assignments, targets,
  studio allocations and specialist assignments explicitly.
- `saveSubject` / `deleteSubject`: validate customer/owner/status and audit.
- `saveTargetAllocation` / `deleteTargetAllocation`: preserve target type,
  assignability and Hunter own/current semantics.
- `saveStudioTargetAllocation` / `deleteStudioTargetAllocation`: preserve
  uniqueness and refresh Hunter current total.
- `saveSpecialistHunterStudioAssignments`: replace selected studio rows for one
  specialist, customer and year atomically.
- `saveStudioBaselineSnapshot`: append immutable comparison snapshot.
- `savePersonCustomerTargets`: browser callers must go through
  `/api/delivery/person-customer-targets`. The command validates the bearer
  token, app access and editor/admin role server-side, then executes the current
  provider implementation under the user's Supabase/RLS context. It atomically
  saves Hunter own/current and Renewal/Amplification targets, optionally
  increasing customer annual targets.
- `removePersonCustomerTargets`: atomically removes direct person/customer
  target facts without deleting unrelated participants.

## SQL Server Readiness Rules

New work should follow these rules:

- keep business logic behind `DeliveryRepository`, backend commands or database
  procedures;
- avoid new direct Supabase imports in UI components;
- avoid relying on Postgres-specific SQL semantics in TypeScript code;
- document any new RPC with a provider-neutral command name;
- model SQL Server equivalents when adding constraints, triggers, RLS policies or
  JSON storage;
- keep annual financial facts normalized by year and grain;
- add contract tests before introducing a second provider.

## Acceptance Checklist For A Future SQL Server Adapter

- read-model parity with current Supabase data snapshot;
- command parity for every method in `DeliveryRepository`;
- role/access parity for viewer, hunter_viewer, editor and admin;
- compensation privacy parity;
- transaction parity for customer/person/target/studio workflows;
- audit parity for sensitive and financial changes;
- dashboard, report, baseline and export parity;
- data export/import runbook;
- rollback plan;
- no production path using local/mock fallback.
