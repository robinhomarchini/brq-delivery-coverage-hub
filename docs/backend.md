# Backend

The app uses Next.js route handlers and repository contracts. Sensitive operations, AI calls and service-role work must stay behind server-side boundaries.

## Boundaries

- Repositories live in `src/lib/repositories`.
- Supabase browser/client access is limited to public-safe operations.
- Server routes under `src/app/api` are the boundary for AI and sensitive workflows.
- Multi-write business rules should be implemented with backend/RPC transaction boundaries when partial success would corrupt data.

## Validation And Errors

- Use Zod where applicable.
- Return actionable pt-BR error messages to the UI.
- Preserve traceability in logs without exposing secrets or sensitive compensation data.
