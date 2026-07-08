# Decisions

Use ADRs under `docs/adr/` for architectural, database, security or integration decisions. This file is the lightweight index for recurring operational decisions.

## Active Decisions

- SDD plus the virtual squad workflow is the default execution model.
- Context optimization is part of the default workflow: read summaries first, inspect source only by impacted module, and avoid generated artifacts.
- Supabase work uses the project-local cache command path.
- Financial facts require explicit year and grain.
- Sensitive compensation data is excluded from broad exports and requires role checks.

## Decision Candidates

- Model direct Hunter responsibility separately from participant Hunter/Farmer assignments.
- Move more critical multi-write rules from browser/client flows to BFF/RPC boundaries.
- Add automated mobile overflow smoke checks for executive screens.
