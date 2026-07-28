# Performance review

- [ ] Record query frequency/concurrency, table size/growth, row width, and result volume.
- [ ] Capture the current `EXPLAIN`; use `EXPLAIN ANALYZE` only when execution is safe.
- [ ] Review scan/join/sort types, estimates versus actuals, loops, rows removed,
      spills, timings, and buffers/I/O when available.
- [ ] Check filters, conversions, N+1 reads, repeated scans/aggregations, and payload.
- [ ] Reconcile semantics and result counts before optimizing.
- [ ] For indexes, record supported query, selectivity, column order, read
      benefit, write/storage cost, and overlap.
- [ ] Evaluate composite, covering, partial, unique, expression, foreign-key,
      and RLS-predicate indexes where relevant.
- [ ] Accept sequential scans when table size/selectivity/planner evidence supports them.
- [ ] Compare before/after plans and measurements under representative conditions.
- [ ] Do not claim improvement or create an index without evidence.

