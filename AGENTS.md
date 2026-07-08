# BRQ Delivery Coverage Hub

## Operating mode

Use Spec Driven Development (SDD). Read the feature specification in
`specs/delivery-coverage-hub/` before changing product behavior.

## Virtual squad workflow

Use the project-local squad layer as a complementary operating model. For
non-trivial work, read `.squad/config.yaml` and `.squad/memory.md` after this
file and before changing code. Treat the main Codex agent as the Tech Lead
orchestrator: understand the request, inspect the project, identify impacted
layers, create an execution checklist, reason through specialist review lenses,
consolidate the solution, and require evidence before completion.

For feature or bugfix work, use this review sequence:
Domain check -> Architecture impact -> Database/source-of-truth check ->
Implementation -> UX Quality Review -> Reuse & Componentization Review ->
Security/RLS Review -> Database Performance Review -> Final Code Review ->
evidence-based response.

Keep `.squad/memory.md` updated with the current objective, decisions, commands,
pitfalls and next pending step when work changes project behavior. Keep
`.squad/config.yaml` aligned with actual project standards. Do not replace the
existing SDD/specs/skills flow; the squad model complements it.

## Lean enterprise engineering mode

This repository inherits the global lean enterprise engineering defaults from
`C:\Users\rmarchini\.codex\AGENTS.md`. Project-local rules below are stricter
where they mention this app's Supabase, repository, target and UX conventions.

For final handoff after implementation or review, use this structure:

- Summary
- Files Changed
- Evidence
- Risks / Pending
- Next Step

## Project conventions

- Canonical project root: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
  Before changing files, verify that `.git`, `package.json`, `src/`, and `supabase/` exist in the working directory. Do not edit the OneDrive stub path `C:\Users\rmarchini\OneDrive - BRQ\Documentos\OrgBRQDelivery` unless the user explicitly asks for it.
- User-facing copy is Portuguese (pt-BR).
- Source code, identifiers, components, functions, and comments are English.
- Keep domain data access behind `src/lib/repositories/`.
- Preserve local mock repositories until Supabase is explicitly introduced.
- Reuse components from `src/components/ui/` for interface primitives.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` after material changes.
- Run `npm run smoke:critical` before deploy when touching customer/person/target persistence flows.
- Use `$project-quality-gate` for non-trivial implementation, bug fixing, and handoff.
- Use `$domain-modeling-data-structure` before model changes involving people, customers, areas/studios, targets, imports, ownership, financial facts, or operational defaults.
- Use `$database-normalization-audit` for schema, Supabase, RLS, migrations, source-of-truth, and cross-screen data consistency work.
- Use `$crud-ux-persistence-check` for CRUD forms, save flows, multi-select assignment UX, and persistence feedback.
- Use `$parallel-agent-orchestration` for broad audits, multi-skill reviews, release readiness, and safe parallel validation.
- Use `$performance-usability-review` as a parallel pre-deploy UX/CX gate for dashboard, CRUD, KPI, table, modal, and executive 16:9 changes. Treat broken KPI alignment, unreadable currency totals, stale modal state, confusing filters, and misplaced feedback as release blockers for touched screens.
- Use `$ux-quality-reviewer` after UI changes to inspect concrete screens/components and flag visual, scroll, responsive, navigation, state, modal, validation and accessibility issues.
- Use `$reuse-componentization-reviewer` after implementation to find real duplication in UI, business logic, formatting, filters, totals, exports and repository calls without over-engineering.
- Use `$database-performance-reviewer` for Supabase/repository/report/import changes to review query patterns, RLS performance, indexes, RPCs, pagination, transactions and migration safety.
- Prefer a single normalized source of truth. Relationship fields shown in UI should be derived from the canonical model whenever possible.
- Do not hardcode operational people, clients, managers, hunters, farmers, areas, studios, or owners in UI components.
- Do not duplicate business rules only in UI. Repository, API, RPC, RLS and/or
  migrations must enforce production-relevant rules when applicable.
- Run `npm run db:migrations:check` when database, migrations, RLS or RPC
  behavior is touched.
- For Supabase CLI automation, use the already-proven project path first:
  `npx --cache .npm-cache --yes supabase <command> --linked`, from the canonical
  project root. Do not start with `npx --no-install supabase ...` in this repo;
  it can touch the global npm cache and fail with EPERM. Use `migration list`
  before `db push`, parse migration versions, and only use `repair` after
  confirming the schema was applied. Treat cache/network/PostHog transport
  failures as transient CLI failures, not as migration drift.
- For this project, Supabase operations must go through the Supabase CLI. If the
  sandboxed CLI path fails with npm cache/EPERM, rerun the same
  `npx --cache .npm-cache --yes supabase ...` command with approved escalation
  instead of switching to browser/manual SQL or inventing a new path.
- Automation scripts must use local/project cache paths, bounded retries, and clear failure messages. Do not keep changing command strategy after one path has produced a reliable result.

## Architecture

- Next.js App Router and TypeScript
- Tailwind CSS and shadcn/ui-style primitives
- Recharts for charts
- Client-side store for the mock CRUD experience
- Repository contracts designed for a future Supabase adapter
- Supabase migrations checked by a non-destructive drift script and scheduled GitHub workflow
