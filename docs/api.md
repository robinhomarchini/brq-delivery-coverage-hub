# API

API style: internal Next.js route handlers plus repository methods.

## Important Surfaces

- `/api/challenge-analysis`: server-side GEN AI challenge analysis. It accepts contextual reassessment input and keeps official numbers immutable.
- Repository contracts in `src/lib/repositories/types.ts`: app data boundary for people, customers, targets, baselines and allocations.
- Export helpers in `src/lib/export.ts`: browser-generated reports and spreadsheets.

## Contract Rules

- Keep OpenAI/Supabase service secrets server-side.
- Validate request shape and business preconditions.
- Separate official persisted facts from derived reports, insights and snapshots.
- Prefer explicit year/scenario/grain in API payloads.
