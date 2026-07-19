# ADR 0003: Specialist hunter studio selection

## Context

`Hunter Especializado` is a managerial cross role. The role needs a target report by
customer and studio, but those values must not change official customer, person or
board totals because they are already contained in studio/customer allocations.

The existing `Metas por Pessoa` screen is already dense and uses official target
allocation rules. Adding editable specialist hunter behavior there would mix an
informational view with official financial target persistence.

## Decision

Persist specialist hunter targets as a normalized selection table:
`specialist_hunter_studio_assignments`.

Each row links one active `Hunter Especializado` person to one existing
`studio_target_allocations` row for a year. The save flow is exposed by a
transactional Supabase RPC that replaces the selection for Person + Customer +
Year. The selection is edited in a dedicated screen and consumed by reports.

This relation does not create `revenue_target_allocations` and does not affect
official totals. It may store an optional `assigned_amount` as a reporting-only
managerial override for the specialist hunter. When the value is absent, reports
continue using the selected Studio allocation value.

## Options Considered

- Reuse `revenue_target_allocations`: rejected because it would mix managerial
  specialist views with official person targets.
- Derive automatically from all linked customer studios: rejected because the
  user needs explicit checkbox selection by client/studio.
- Store official manual amounts per specialist hunter: rejected because it would
  duplicate target facts and create reconciliation drift.
- Store a reporting-only override on the explicit selection: accepted later as a
  narrow exception because the value is isolated from official customer, person,
  dashboard and baseline totals.

## Trade-offs

- The model adds one table and RPC, but keeps official financial facts normalized.
- Reports require the selection to exist; this makes the managerial scope explicit
  instead of silently including every studio from a linked customer.
- The dedicated UI adds one route, but avoids making the current person-target
  screen more complex.

## Consequences

- Admin/editor users can select which studio target rows compose the managerial
  specialist hunter report.
- RLS and backend validation enforce that only active `Hunter Especializado`
  people can receive these selections.
- Changing studio target values automatically changes the reported specialist
  hunter totals only when `assigned_amount` is empty. If `assigned_amount` is
  filled, the specialist hunter report uses the managerial override.

## Date

2026-07-08
