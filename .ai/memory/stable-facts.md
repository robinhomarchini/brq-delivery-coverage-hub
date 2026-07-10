# Stable Facts

- Canonical root: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- UI copy is pt-BR; code identifiers are English.
- Main commands: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run smoke:critical`.
- Supabase CLI path: `npx --cache .npm-cache --yes supabase <command> --linked`.
- Persistence boundary: `DeliveryRepository` and adapters under `src/lib/repositories`.
- Auth boundary: `src/lib/auth/auth-service.ts`.
- Current production backend: Supabase/Postgres with RLS/RBAC.
- Future portability target: Microsoft SQL Server through provider-neutral repository/BFF boundaries.
- Financial facts must remain year/scenario/grain aware and derived from canonical sources.
- Critical changes require Codex review; the local router may classify and summarize only.
