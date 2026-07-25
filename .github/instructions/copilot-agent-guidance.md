# Copilot Agent Guidance — BRQ Delivery Coverage Hub

## Purpose

This file summarizes how developers and Copilot should invoke the repository agents.

## Required documents

- `.github/copilot-instructions.md` — canonical Engineering Constitution
- `.github/agents/*` — focused agent workflows
- `.github/prompts/copilot-agent-routing.md` — routing guidance

## Invocation examples

### Domain Rule Guardian

Use this agent for any material change that affects financial, allocation, or baseline rules.

Example prompt:

```
Use the Domain Rule Guardian workflow.
I need the following required inputs before editing:
- Business concept
- Canonical source of truth
- Data grain
- Inclusions
- Exclusions
- Role behavior
- Year and scenario boundaries
- Baseline vs operational semantics
- Persistence implications
- All affected consumers
- Numerical examples
- Counterexamples
- Historical and inactive-record behavior

Return only the required output template.
```

### Change Impact Mapper

Use this agent before making changes to domain logic, persistence, reports, or exports.

Example prompt:

```
Use the Change Impact Mapper workflow.
Map the complete blast radius before editing.
Search for equivalent calculations, filters, role classification logic, totals, rounding, baseline derivation, allocation summation, hardcoded identities, legacy fields, and fallbacks.
Return only the required output template.
```

### Regression Scenario Engineer

Use this agent to generate generalized regression cases for financial/allocation fixes.

Example prompt:

```
Use the Regression Scenario Engineer workflow.
Evaluate all required scenarios and generalize the invariant.
Do not write implementation code.
```

### Cross-View Reconciliation Reviewer

Use this agent to validate consistency across dashboards, reports, exports, and persisted data.

Example prompt:

```
Use the Cross-View Reconciliation Reviewer workflow.
Inspect all required views and output the reconciliation table.
```

### Adversarial Reviewer

Use this agent after a proposed solution is identified, before approval.

Example prompt:

```
Use the Adversarial Reviewer workflow.
Evaluate the proposed fix against the required questions.
Return an explicit verdict.
```

## Routing model

- Financial discrepancy → follow financial workflow in `.github/prompts/copilot-agent-routing.md`
- UX-only defect → use UX and accessibility review only
- Supabase persistence change → use persistence workflow
- Report/export change → use report workflow
- Auth/authorization change → use security workflow

## Team-facing note

This guidance is intentionally lightweight. The canonical rules are in `.github/copilot-instructions.md`.
Do not duplicate the Constitution here.
