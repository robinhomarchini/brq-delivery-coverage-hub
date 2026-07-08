# Project Memory

This is the compact entry point for future Codex sessions.

## Stable Facts

- Project: BRQ Delivery Coverage Hub.
- Canonical root: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- Do not edit the OneDrive copy unless explicitly requested.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, Supabase, Vercel.
- UI language: pt-BR.
- Code language: English identifiers.
- Domain source of truth is normalized repository/database data, not hardcoded UI lists.

## Current Operational Rules

- Use SDD via `AGENTS.md` and specs under `specs/delivery-coverage-hub`.
- Use `.squad/memory.md` for active-task continuity.
- Use `.codexignore` and `docs/context-strategy.md` to avoid loading generated or bulky files.
- For Supabase CLI, use `npx --cache .npm-cache --yes supabase <command> --linked`.
- Before deploy, run lint, typecheck, build and smoke critical when persistence changed.

## Recent Decisions

- Studio baseline comparison is Planilha vs Hunters/Alocacoes, not Planilha vs total customer studio values.
- Studio baseline snapshots are immutable photos of calculated results.
- Studio Hunter is detail contained in Hunter logic and must not be double-counted.
- Baseline de Studios has filters for Status and Studio; comparison text must explain Novo/Ampliacao vs Hunter allocations and maintenance/renewal vs client/studio maintenance.
- Metas por Area/Studio uses an intermediate picker when a customer has multiple Studio/Hunter allocations in the selected year.
- Mobile should avoid horizontal page overflow; complex operational flows may be gated.
