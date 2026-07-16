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
- For comparison tables with stacked/multi-source rows, use shared stable-height cells such as `StackedComparisonCell`; do not hand-roll multi-line table cells that can wrap labels and desynchronize values across columns.
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
- Vercel production operations must use the versioned project scripts only:
  `npm run deploy:check`, `npm run deploy:prod`, `npm run deploy:inspect:prod`,
  and `npm run deploy:inspect -- <deployment-url>`. Do not run raw
  `npx vercel ...` commands in this repo; the scripts load local env files,
  pin Node/Vercel versions, and isolate Windows cache paths.
- GitHub Actions status checks should use `npm run github:checks`. If it returns
  a repository/API 404, do not retry raw `gh run list` variants; validate
  permissions or inspect the run in GitHub UI.

## Security & Production Readiness Gates

**OBRIGATÓRIO** para qualquer mudança que toque: autenticação, autorização, RLS, migrations, schema, APIs sensíveis, configurações de ambiente, CSP, headers, ou secrets.

### Critical Security Checklist

- [ ] **CSP never uses `unsafe-inline` for script-src in production**
  - script-src must not be tightened unless browser hydration smoke proves Next scripts run
  - Validate rendered HTML and browser console before production deployment
  - Development can use `unsafe-eval` for debugging, but **never commit**

- [ ] **Hardcoded test data never in migrations**
  - Before commit, run: `grep -r "robinson.marchini|acoelho|test@|demo@" supabase/migrations/`
  - All seed data must use variables or conditional imports, never static SQL INSERTs
  - Run `npm run security:check` — blocks commits with hardcoded sensitive data

- [ ] **Secrets protected in environment files**
  - `SUPABASE_SERVICE_ROLE_KEY` must NEVER appear in `.env.example` or `.env.production`
  - If mentioning in `.env.example`, add **SECURITY WARNING** comment explaining local-only usage
  - `.env.local` must be in `.gitignore` (verify with `grep .env.local .gitignore`)
  - No credentials, tokens, or API keys in version control

- [ ] **Supabase Auth sign-up disabled in production**
  - If enabled, any `@brq.com` email can register
  - Validate in Supabase dashboard: Auth → Settings → disable Email/Password signup for production
  - Document status in [PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md)

- [ ] **BFF required for sensitive write operations**
  - `savePerson()`, `saveArea()`, `saveSubject()` must have corresponding `POST /api/delivery/[entity]`
  - BFF must validate: session (via bearer token) + papel (viewer/editor/admin) + RLS rules
  - Never send raw `DeliveryRepository` writes directly from browser to Supabase
  - Example: [src/app/api/delivery/customers/route.ts](src/app/api/delivery/customers/route.ts)

- [ ] **Rate limiting on `/api/delivery/*` routes**
  - Prevents DoS even from authenticated users
  - Use `@upstash/ratelimit` or custom middleware with time-window buckets
  - Example: 100 requests/minute per user per endpoint

- [ ] **Migrations pass `npm run db:migrations:check`**
  - Validates RLS policies are explicit (not generic)
  - Confirms no forward references or circular dependencies
  - Policies must use `SECURITY DEFINER` for sensitive RPCs
  - No migration bypasses RLS or removes constraints without justification

### Review Lenses for Security

**Deploy blocked if ANY of these fail**:

1. **CSP Reviewer**: CSP changes require rendered HTML + browser hydration evidence
2. **Secrets Reviewer**: grep `.env.*` and migrations for credentials — found = fail
3. **RLS Reviewer**: all table policies use `is_active_brq_user()`, `can_edit_delivery_data()`, `is_delivery_admin()`
4. **BFF Reviewer**: no sensitive writes bypass `/api/delivery/*` routes
5. **Migration Reviewer**: `npm run db:migrations:check` passes

### Commands Before Every Push

```bash
npm run lint                 # ESLint
npm run typecheck           # TypeScript strict
npm run test:contracts      # Repository contract
npm run security:check      # CSP, secrets, RLS, audit
npm run build               # Includes all above
```

### Commands Before Every Production Deploy

```bash
npm run db:migrations:check   # RLS/migrations validation
npm run test:performance      # Memoization, indexes
npm run smoke:critical        # Customer-hunter, targets
npm run smoke:rls             # RLS with real roles
npm run security:pentest-lite # Pentest against URL
```

## Incident Prevention — Lessons from 2026-07-14

### Incident 1: CSP unsafe-inline Allowed XSS

**Root cause**: `script-src 'self' 'unsafe-inline'` permitted direct XSS via attribute events.

**Prevention**:

- Do not publish a nonce CSP unless rendered Next scripts receive matching nonces
- `next.config.ts` must NOT add static CSP without browser hydration smoke
- Review gate: block CSP changes without console/network evidence

### Incident 2: Hardcoded Test Data in Migrations

**Root cause**: User emails (`robinson.marchini@brq.com`, `acoelho@brq.com`) were hardcoded in migration SQL INSERTs.

**Prevention**:

- CI/CD gate: `grep -r "robinson.marchini|acoelho|test@|demo@" supabase/migrations/ && exit 1`
- `npm run security:check` must block commits with hardcoded sensitive data
- All seed data via variables or feature flags, never static SQL

### Incident 3: SERVICE_ROLE_KEY Exposed in .env.example

**Root cause**: Sensitive Supabase key was documented (even commented) in version control.

**Prevention**:

- **Never** add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` or `.env.production`
- If mentioning, add SECURITY WARNING explaining local-only usage in comments
- CI/CD gate: `grep "SUPABASE_SERVICE_ROLE_KEY=" .env.example && exit 1`

### Incident 4: Missing BFF for Sensitive Operations

**Root cause**: `savePerson()` called Supabase directly from browser, bypassing server-side validation.

**Prevention**:

- All CRUD writes must go through BFF routes (`/api/delivery/*`)
- BFF validates session + papel + RLS before touching database
- Review gate: "no sensitive write operation without corresponding BFF"

### Incident 5: Incomplete CI/CD — Manual Deploys

**Root cause**: Deploy was manual `npx vercel deploy --prod --yes`, without automated checks.

**Prevention**:

- GitHub Actions workflow (`.github/workflows/`) runs lint → typecheck → test → build → deploy
- Pipeline blocks deploy if any check fails
- Rollback plan documented in [docs/ROLLBACK_PLAN.md](docs/ROLLBACK_PLAN.md)

### Incident 6: Missing Rate Limiting

**Root cause**: Authenticated users could DoS `/api/delivery/*` with parallel requests.

**Prevention**:

- Rate limiting middleware on all `/api/delivery/*` routes
- Example: 100 requests/minute per user
- Use `@upstash/ratelimit` or custom middleware

### Incident 7: Store Without Pagination

**Root cause**: `getAll()` loaded all 10k+ rows, blocking UI on first load.

**Prevention**:

- `DeliveryRepository.getAll()` must support `{ limit: 100, offset: 0 }`
- Store implements lazy loading — loads paginated chunks, not full dataset
- Performance test blocks any full-load reintroduction

### Incident 8: RLS Changes Untested

**Root cause**: Migration changed RLS policies without automated tests.

**Prevention**:

- `npm run smoke:rls` obrigatório before deploy
- Docker Postgres container runs migrations locally + tests each policy with viewer/editor/admin/blocked roles
- CI/CD runs smoke RLS with dedicated test accounts

## Architecture

- Next.js App Router and TypeScript
- Tailwind CSS and shadcn/ui-style primitives
- Recharts for charts
- Client-side store for the mock CRUD experience
- Repository contracts designed for a future Supabase adapter
- Supabase migrations checked by a non-destructive drift script and scheduled GitHub workflow
