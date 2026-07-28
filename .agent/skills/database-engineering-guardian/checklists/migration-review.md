# Migration review

- [ ] Confirm the migration is forward-only and historical migrations are unchanged.
- [ ] List affected objects, consumers, data volume, and compatibility window.
- [ ] Assess locks, table rewrites, timeouts, long transactions, and production load.
- [ ] Preserve data and define duplicate/orphan handling without inventing rules.
- [ ] Plan additive structure, compatible deploy, backfill, validation,
      constraint enforcement, and later cleanup when risk requires phases.
- [ ] Make large backfills bounded, resumable, observable, and operationally owned.
- [ ] Choose safe index creation and constraint validation strategies.
- [ ] Separate controlled data repair from schema evolution.
- [ ] Define pre/post validation, reconciliation, rollback/forward-fix guidance,
      and exact deployment order.
- [ ] Verify generated types, repository contracts, RLS, grants, and dependent views/RPCs.

