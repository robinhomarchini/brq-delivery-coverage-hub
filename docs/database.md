# Database

Engine: Supabase Postgres with SQL migrations in `supabase/migrations`.

## Canonical Facts

- People: `people`.
- Customer ownership and participation: relationship tables, not hardcoded UI lists.
- Customer annual targets: `customer_target_years`, keyed by customer and year.
- Person/customer targets: `revenue_target_allocations`.
- Studio allocations: `studio_target_allocations`, keyed by customer, studio/area, hunter, and year.
- Board baseline: `board_target_baselines`, separate from operational targets.
- Studio baseline snapshots: `studio_baseline_snapshots`, immutable comparison photos.
- Compensation: `person_compensations`, sensitive and role-restricted.

## Migration Rules

- Use the project command: `npx --cache .npm-cache --yes supabase <command> --linked`.
- Run migration list before db push.
- Treat cache, telemetry and network failures as CLI failures until schema drift is proven.
- Do not use migration repair, reset or manual SQL without explicit approval.
- Financial facts must include year, scenario/grain and source of truth.

## Security

RLS and grants must enforce access. UI hiding is only a convenience layer. Service role keys stay server-side.
