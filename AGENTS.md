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
- Use `$database-normalization-audit` for schema, Supabase, RLS, migrations, source-of-truth, and cross-screen data consistency work.
- Use `$crud-ux-persistence-check` for CRUD forms, save flows, multi-select assignment UX, and persistence feedback.
- Prefer a single normalized source of truth. Relationship fields shown in UI should be derived from the canonical model whenever possible.

## Architecture

- Next.js App Router and TypeScript
- Tailwind CSS and shadcn/ui-style primitives
- Recharts for charts
- Client-side store for the mock CRUD experience
- Repository contracts designed for a future Supabase adapter
