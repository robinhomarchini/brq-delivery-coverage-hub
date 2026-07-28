# Schema review

- [ ] State the domain concept, grain, owner, and canonical source of truth.
- [ ] Verify primary keys, stable identifiers, foreign keys, uniqueness, checks,
      nullability, defaults, and orphan prevention.
- [ ] Establish one-to-one, one-to-many, or many-to-many cardinality and use a
      junction table where appropriate.
- [ ] Verify compatible types, financial precision, dates/instants, statuses,
      roles, and explicit null semantics.
- [ ] Separate persisted facts from derived values and report duplicated truth.
- [ ] Review normalization; justify denormalization with synchronization,
      integrity protection, and measured benefit.
- [ ] Review JSON/arrays that may be replacing relational structures.
- [ ] Define period, scenario, validity interval, history, and audit fields.
- [ ] Confirm ownership, authorization scope, and dependent-record lifecycle.
- [ ] Report missing constraints, implicit relationships, and frontend-only rules.

