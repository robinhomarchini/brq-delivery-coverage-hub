# Coding Standards

## Project Style

- TypeScript, React and Next.js App Router.
- User-facing text in pt-BR; identifiers and comments in English.
- Prefer existing local patterns over new abstractions.
- Keep domain access behind repositories or server routes.
- Avoid hardcoded operational people, customers, studios, managers or hunters.

## Change Discipline

- Read specs/docs before non-trivial changes.
- Make the smallest coherent change.
- Update docs/specs when behavior changes.
- Preserve unrelated dirty worktree changes.
- Use `apply_patch` for manual edits.

## Validation

Material app changes: `npm run lint`, `npm run typecheck`, `npm run build`.

Customer/person/target persistence changes: also run `npm run smoke:critical`.

Schema/RLS changes: also run `npm run db:migrations:check`.
