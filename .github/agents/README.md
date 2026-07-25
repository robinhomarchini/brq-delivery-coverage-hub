# GitHub Copilot Agents — BRQ Delivery Coverage Hub

This folder defines reusable Copilot agent workflows for the repository.

## Purpose

These agents are not code. They are structured review and reasoning workflows that
Copilot tasks should follow before making material changes.

## How to use

1. Start with the canonical Engineering Constitution in `.github/copilot-instructions.md`.
2. Use the agent that matches the task type.
3. Complete the required output template before touching code.
4. Do not skip the Constitution or the required inputs.

## Agent files

- `domain-rule-guardian.md`
- `change-impact-mapper.md`
- `regression-scenario-engineer.md`
- `cross-view-reconciliation-reviewer.md`
- `adversarial-reviewer.md`

## Routing

For financial or allocation changes, follow the routing guidance in
`.github/prompts/copilot-agent-routing.md`.

## Notes

- Each agent is focused and does not repeat the full Constitution.
- The Constitution remains the authoritative source of truth.
- Use `.github/instructions/copilot-agent-guidance.md` for invocation examples and team guidance.
