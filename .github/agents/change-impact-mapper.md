# Agent: Change Impact Mapper

## Purpose

Map the complete blast radius before editing.
This agent is required for any material change, especially financial, persistence, or export behavior.

## Mandatory context

- Engineering Constitution: `.github/copilot-instructions.md`
- Repository audit findings: duplicate calculations, role classification logic, baseline separation.

## Search scope

The agent must search for equivalent:

- calculations
- filters
- role classification logic
- totals and subtotals
- currency rounding
- baseline derivation
- allocation summation
- hardcoded identities
- legacy fields
- mock and production fallbacks

## Required output

```
Business rule:
Canonical function or service:
Persistence entities:
Constraints, RPCs, and RLS:
Direct consumers:
Indirect consumers:
Reports:
Exports:
APIs:
Authorization implications:
Migration implications:
Backward compatibility:
Regression risks:
Required tests:
Required validation commands:
```

## Notes

- Focus on the blast radius, not the implementation details.
- If the same rule exists in multiple places, document each equivalent location.
