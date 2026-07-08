# Codex Workspace Optimization Report

Date: 2026-07-06

## Current Token Consumption Risks

- Broad recursive reads include `.next`, `node_modules`, `.npm-cache`, logs and binary spreadsheets.
- Large generated/cache files dominate repository size and produce noisy command output.
- Specs and memory files are useful but long; future work needs summary-first entry points.
- Global Codex state under `C:\Users\rmarchini\.codex` contains large logs and caches; these should not be loaded for project work.
- Some agent responsibilities overlap, especially quality, UX, database and deployment checks.

## Implemented Improvements

- Added `.codexignore` as a strict LLM context ignore policy.
- Added `docs/context-strategy.md` with progressive context loading rules.
- Added compact project summaries for architecture-adjacent areas:
  - `docs/database.md`
  - `docs/frontend.md`
  - `docs/backend.md`
  - `docs/api.md`
  - `docs/business-rules.md`
  - `docs/coding-standards.md`
- Added memory files:
  - `docs/project-memory.md`
  - `docs/decisions.md`
  - `docs/domain-model.md`
  - `docs/glossary.md`
- Updated repository ignore guidance to keep runtime artifacts outside source control and future context.
- Installed a global context policy for all projects:
  - `C:\Users\rmarchini\.codex\CONTEXT_POLICY.md`
  - `C:\Users\rmarchini\.codex\CODEXIGNORE_TEMPLATE`
  - concise global `AGENTS.md` context-optimization section.
- Cleaned global Codex historical/cache artifacts:
  - removed `.codex\.tmp`
  - removed `.codex\tmp`
  - removed `.codex\generated_images`
  - removed `.codex\archived_sessions`
  - removed session JSONL files older than the active day when safely identifiable.
- Preserved active Codex SQLite state, auth and config files.

## Headroom

No trustworthy Codex-compatible Headroom package or documented integration was found during the check. Because installing an ambiguous package could reduce reliability and security, Headroom was not installed. The implemented context policy covers the requested non-aggressive behavior: duplicate avoidance, structured summaries, output compression, cache exclusion and progressive loading.

## Expected Impact

- First-turn repository discovery should usually read fewer than 10 concise files instead of scanning dozens of source/spec files.
- Generated artifacts and caches should be excluded from normal LLM context.
- Large binary/report artifacts should be inspected by metadata first, not loaded directly.
- Estimated token reduction for future discovery: 40-70% on typical feature work, higher for tasks that previously triggered recursive listings.
- Global historical session files dropped from about 423 MB to about 43 MB. Temporary/plugin/image/archive artifacts of about 179 MB were removed.

## Remaining Opportunities

- Periodically archive or compact global Codex logs/caches after explicit user approval.
- Add automated checks for horizontal overflow/mobile layout.
- Add module-level summaries for the largest feature areas if they continue changing often.
- Avoid deleting active SQLite logs while Codex is running; compact/rotate them only with the app closed or with a supported maintenance command.
