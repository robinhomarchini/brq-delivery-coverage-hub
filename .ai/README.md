# Local AI Task Router

This folder contains a lightweight local task router and context selector for this repository.

It does not replace Codex. It only classifies requests, selects likely relevant files and prints a compact context package. It must not edit production code, migrations, security policies, commits or deployments.

## Commands

```bash
npm run ai:route -- "summarize the latest build log"
npm run ai:context -- "fix the official report export"
npm run test:ai-router
```

Set a smaller or larger file budget:

```bash
npm run ai:route -- --max-files 8 "review auth changes"
```

## Optional Ollama-Compatible Local Model

The router works without a local model. To enable an optional local endpoint:

```bash
LOCAL_AI_ENABLED=true
LOCAL_AI_BASE_URL=http://localhost:11434
LOCAL_AI_MODEL=<local-model-name>
```

If the model is unavailable, the router falls back to deterministic rules and never blocks Codex work.

## Routing Levels

- `LOCAL_ONLY`: summarize, locate files, explain logs, classify, generate checklist.
- `CODEX_STANDARD`: component, hook, navigation, report, dashboard, export, repository or medium-risk refactor.
- `CODEX_CRITICAL`: database, Supabase, migrations, RPC, RLS/RBAC, auth, security, financial source of truth, transactional behavior, production config or cross-layer architecture.
- `UNKNOWN`: escalates to Codex; never defaults to local-only.

## VS Code Tasks

Use:

- `AI: Classify Task`
- `AI: Build Context Package`
- `AI: Check Local Model`

The first two tasks prompt for the request and print the YAML result in the terminal.

## Safety

The local model may only classify and summarize. It must not approve, commit, push, change migrations, change security policies or expose secrets.

## Context selection policy

The selector applies the same eligibility checks to traversal, explicit references,
imports and stable memories before reading their content. Files outside the project,
symbolic links/junctions, local `.env*` secrets (except `.env.example`), dependency
caches and binary/large artifacts cannot enter the automatic package.

Project `.codexignore` rules support blank lines, whole-line comments, ordered `!`
negation, `/`-rooted paths, trailing `/` directories and native Node glob matching
(`*`, `**`, `?` and character classes). Patterns without a slash match basenames at
any depth; paths with a slash are relative to the root. This is a context policy,
not a complete gitignore parser: escaped comments/spaces and nested ignore files
are unsupported. Negation cannot re-include descendants of an excluded directory
unless that directory is also re-included, or override the mandatory safety filters.
Native glob matching requires Node 22.5 or newer.

`ENGINEERING_STANDARD.md`, `AGENTS.md`, `PROJECT_OVERVIEW.md` and `CURRENT_STATE.md`
take priority over source files when eligible. Stable-context headings are read only
for selected files, within the same budget. Negative budgets select zero files;
fractional budgets are rounded down and non-finite budgets use the default of 12.
