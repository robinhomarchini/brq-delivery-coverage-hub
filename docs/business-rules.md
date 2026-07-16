# Business Rules

## Targets

- Customer targets are annual facts.
- Board baselines are reference facts and must not be overwritten by operational edits.
- Operational customer targets, person targets and studio allocations are separate sources and are compared through reports.
- Saving a customer target must not overwrite existing person target allocations. Customer targets express the account objective; person targets express allocation/reconciliation and can legitimately be above, below or equal to the customer target.

## Hunters And Studios

- A customer can have a direct responsible Hunter and additional participants.
- Hunter person targets store two values: `own_amount` is the editable own target, and `amount` is the derived current Hunter total.
- Current Hunter total is `own_amount + Studio Hunter` for the same customer, person and year.
- Studio Hunter is a breakdown contained in the current Hunter total; do not add it again as a second Hunter total.
- Studio Manutencao/Renovacao does not compose Hunter reports.
- In client views, Hunter coverage uses the applicable Hunter/direct participants plus Studio Hunter detail without duplicate counting.
- `Hunter Especializado` is a cross/managerial role. It has no own target and must not receive direct rows in `revenue_target_allocations`.
- Specialist Hunter reporting is derived from Studio allocations for the customers linked to the person. It does not change customer totals, person totals, dashboard totals, baseline comparisons or challenge analysis.

## Delivery / Farmers / Managers

- Delivery and Farmer views focus on customer ownership and renewal/amplification responsibilities.
- Studio details are shown where they explain the client composition, but manager totals should avoid counting studios unless the person has a Hunter role.

## Baselines

- Customer baseline compares approved board values against operational customer/person views.
- Studio baseline compares spreadsheet Studio Hunter values against hunter allocations, and Studio Manutencao values against client studio maintenance allocations.
- Saved snapshots preserve the comparison result; they do not update official targets.
- The Studio baseline screen loads the latest saved snapshot for the selected year as an audit photo. Uploading a new spreadsheet recalculates the comparison for the current session.

## Sensitive Data

Salary/compensation is sensitive. It is visible and editable only for authorized admin + VP/C-level contexts and must remain excluded from broad exports.
