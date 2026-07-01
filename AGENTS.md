# BRQ Delivery Coverage Hub

## Operating mode

Use Spec Driven Development (SDD). Read the feature specification in
`specs/delivery-coverage-hub/` before changing product behavior.

## Project conventions

- User-facing copy is Portuguese (pt-BR).
- Source code, identifiers, components, functions, and comments are English.
- Keep domain data access behind `src/lib/repositories/`.
- Preserve local mock repositories until Supabase is explicitly introduced.
- Reuse components from `src/components/ui/` for interface primitives.
- Run `npm run lint`, `npm run typecheck`, and `npm run build` after material changes.
- Use `$project-quality-gate` for non-trivial implementation, bug fixing, and handoff.
- Use `$domain-modeling-data-structure` before model changes involving people, customers, areas/studios, targets, imports, ownership, financial facts, or operational defaults.
- Use `$database-normalization-audit` for schema, Supabase, RLS, migrations, source-of-truth, and cross-screen data consistency work.
- Use `$crud-ux-persistence-check` for CRUD forms, save flows, multi-select assignment UX, and persistence feedback.
- Use `$parallel-agent-orchestration` for broad audits, multi-skill reviews, release readiness, and safe parallel validation.
- Prefer a single normalized source of truth. Relationship fields shown in UI should be derived from the canonical model whenever possible.
- Do not hardcode operational people, clients, managers, hunters, farmers, areas, studios, or owners in UI components.
- For Supabase CLI automation, prefer the simplest read-only command that already worked in this repo before trying alternatives. Use `npx --no-install supabase migration list --linked` locally, parse migration versions, and only use `repair` after confirming the schema was applied. Treat cache/network/PostHog transport failures as transient CLI failures, not as migration drift.
- Automation scripts must use local/project cache paths, bounded retries, and clear failure messages. Do not keep changing command strategy after one path has produced a reliable result.

## Architecture

- Next.js App Router and TypeScript
- Tailwind CSS and shadcn/ui-style primitives
- Recharts for charts
- Client-side store for the mock CRUD experience
- Repository contracts designed for a future Supabase adapter
- Supabase migrations checked by a non-destructive drift script and scheduled GitHub workflow
