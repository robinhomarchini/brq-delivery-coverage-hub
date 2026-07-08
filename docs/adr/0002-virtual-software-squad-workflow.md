# ADR 0002 - Virtual Software Squad Workflow

Date: 2026-07-03

## Context

The project already uses Spec Driven Development through `AGENTS.md`, feature specs under `specs/delivery-coverage-hub/`, a `.codex/` project-agent layer, and reusable quality/security/domain skills. The user wants future Codex work to behave like a virtual software squad without replacing the current repository structure or established behavior.

The project is a database-backed internal executive application with financial targets, customer/person ownership, Supabase Auth/RLS, Vercel deployment, and multiple user-facing workflows. Changes often cross domain, persistence, frontend, security, documentation, validation and deployment concerns.

## Decision

Adopt a complementary `.squad/` operating layer:

- `.squad/memory.md` stores working memory, project facts, commands, pitfalls, decisions and the next pending step.
- `.squad/config.yaml` stores the project contract: stack, architecture, database, auth, quality gates, security checks, deployment and specialist review lenses.
- `AGENTS.md` will direct future Codex turns to read `.squad/` for non-trivial work.
- Important architecture, database, security or integration decisions continue to be recorded as ADRs under `docs/adr/`.

The Codex orchestrator behavior is defined as a Tech Lead: understand the request, inspect the repo, identify impacted layers, create a checklist, reason through specialist lenses, consolidate the solution and provide evidence before completion.

## Options Considered

1. Only keep the existing `AGENTS.md` and `.codex/` behavior.
   - Lower churn, but weaker resumability and less explicit enterprise quality gating.

2. Replace existing agent conventions with a new squad framework.
   - More uniform, but risky because it would conflict with existing SDD, specs and project-specific conventions.

3. Add `.squad/` as a complementary operating layer.
   - Preserves existing behavior while adding memory, contract, Tech Lead orchestration and stronger review lenses.

## Trade-offs

- The `.squad/` layer adds documentation that must be maintained.
- Some checklist items will be intentionally non-applicable for small tasks; the final response must say so rather than pretending they were done.
- The model improves consistency and handoff quality, but it does not replace actual tests, migrations, security enforcement or product validation.

## Consequences

- Future non-trivial changes should begin by reading `AGENTS.md`, `.squad/config.yaml`, `.squad/memory.md` and relevant specs.
- Final answers should include Summary, Impacted Areas, Evidence, Risks / Pending Items and Suggested Next Step.
- UX and enterprise production readiness checks become explicit before completion.
- Important architectural direction changes require ADR updates instead of silent implementation.
