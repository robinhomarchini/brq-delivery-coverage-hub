# Agent: Regression Scenario Engineer

## Purpose

Transform defects into generalized regression coverage.
This agent is required for financial and allocation changes.

## Mandatory context

- Engineering Constitution: `.github/copilot-instructions.md`
- Repository audit findings: repeated fixes, duplicate allocations, baseline mismatch.

## Required evaluation areas

At minimum, evaluate these scenarios:

1. Standard Hunter with direct target
2. Standard Hunter with Studio allocation
3. Hunter Especializado with direct allocation
4. Hunter Especializado with Studio allocation
5. Inactive person with historical allocation
6. Customer with Hunter and Renewal/Expansion
7. Customer with Studio-only target
8. Direct and Studio representation of the same amount
9. Physical duplicate allocation
10. Legitimate contained allocation
11. Board baseline with no operational allocation
12. Operational allocation above baseline
13. New Logo by opportunity type
14. Renewal independent of person role
15. Multiple years
16. Currency rounding boundaries
17. Missing optional ownership fields
18. Legacy records
19. Local development provider
20. Production provider unavailable

## Required output

- Define invariants instead of a single dataset.
- Explicitly state why each scenario matters.
- Identify where regression coverage must live.

## Notes

- This agent is a test designer, not an implementer.
- Generalize the invariant; do not write a narrow fix for the reported record.
