# Query review

- [ ] Confirm business semantics, grain, stable output contract, and reconciliation target.
- [ ] Use explicit columns, parameters, null semantics, ordering, and bounded results.
- [ ] Establish every join's relationship, cardinality, key uniqueness/types,
      null behavior, expected row counts, fan-out, duplicate risk, and indexes.
- [ ] Reject Cartesian products and `DISTINCT` used to conceal join errors.
- [ ] Check early filters, predicate selectivity, conversions, functions, casts,
      sorting, pagination, and payload size.
- [ ] Detect N+1 reads, correlated/repeated subqueries, scans, and aggregations.
- [ ] Validate grouping keys, financial precision, periods, inactive records,
      temporal validity, category overlap, and many-to-many multiplication.
- [ ] Keep target, allocation, actual, forecast, pipeline, baseline, renewal,
      expansion, and opportunity distinct.
- [ ] Inspect `EXPLAIN`; use `EXPLAIN ANALYZE` only in a safe non-production environment.
- [ ] Reconcile row counts and totals against the canonical source.

