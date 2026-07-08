# Context Strategy

Goal: keep Codex context small while preserving engineering quality.

## Default Flow

1. Read `AGENTS.md`, `.squad/config.yaml`, `.squad/memory.md`, and this file.
2. Prefer summary docs before source files:
   - `docs/architecture.md`
   - `docs/domain.md`
   - `docs/database.md`
   - `docs/backend.md`
   - `docs/frontend.md`
   - `docs/api.md`
   - `docs/business-rules.md`
   - `docs/coding-standards.md`
   - `docs/project-memory.md`
3. Inspect source only for the impacted module.
4. Use `rg` to locate symbols and narrow reads with line ranges.
5. Avoid loading generated files, caches, logs, binary assets, build outputs and lockfile diffs unless required.
6. Update `docs/project-memory.md` and `.squad/memory.md` when a decision prevents future rediscovery.

## Read Order By Task

- UI/layout: `docs/frontend.md`, relevant component, shared UI primitive.
- Business rule: `docs/business-rules.md`, domain model, repository method, affected screen.
- Database/RLS: `docs/database.md`, latest migrations, repository adapter, affected API.
- Export/import: `docs/api.md`, `docs/domain.md`, parser/export helper, sample file metadata only.
- Deploy: `docs/backend.md`, `docs/coding-standards.md`, runbook, Vercel/Supabase commands.

## Output Discipline

- Summarize large command results instead of pasting full dumps.
- Report file counts, top large paths and risks, not complete recursive listings.
- Use evidence from commands, but keep final handoff compact.
