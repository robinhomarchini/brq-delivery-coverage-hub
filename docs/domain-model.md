# Domain Model

## Core Entities

- Person: employee or role holder in the organization.
- Customer: client/account with delivery/commercial responsibilities.
- Area/Studio: organizational capability grouping.
- Target: annual financial fact at a defined grain.
- Baseline: approved reference fact for comparison.
- Snapshot: immutable captured comparison result.

## Relationships

- People can be assigned to customers in roles such as Delivery, Hunter, Farmer or mixed roles.
- Customers can have direct responsible owners and additional participants.
- Studio allocations connect customer, area/studio, hunter/person and year.
- Baselines remain separate from operational targets.

## Derived Views

- Executive dashboard: derived from active people, customers, targets and baselines.
- Customer portfolio: derived from customer ownership and annual target facts.
- Person reports: derived from person/customer allocations plus role rules.
- Studio baseline comparison: derived from imported baseline rows and current allocations.
