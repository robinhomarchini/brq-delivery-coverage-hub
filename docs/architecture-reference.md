# Architecture Reference

This document supplements `docs/ARCHITECTURE.md` with a current structural
overview of the codebase, module map, and observed technical debt.

## Folder Structure

- `src/app`: Next.js App Router pages, layouts, and API routes.
- `src/components`: domain components, layout shell, shared UI primitives, and reports.
- `src/data`: mock data, initial seeds, and domain TypeScript interfaces.
- `src/hooks`: reusable client hooks.
- `src/lib`: repositories, auth, access control, validation, exports, utilities, and AI helpers.
- `src/server`: server-only auth guards, command access, and AI integrations.
- `src/store`: React Context-based client store for delivery data.
- `supabase/migrations`: database schema, RLS, RPCs, and indexes.
- `specs`: feature requirements, technical plans, and acceptance criteria.
- `docs`: project memory, ADRs, and operational guides.
- `.ai`: local task router, context selector, and agent memory.
- `.codex`: Codex agent definitions and decision logs.

## Module Responsibilities

- `src/app/api/delivery/customers` and `src/app/api/delivery/person-customer-targets`: BFF command handlers for critical writes.
- `src/lib/repositories`: persistence abstraction with local-dev and Supabase adapters.
- `src/lib/auth`: provider-neutral authentication service abstraction.
- `src/lib/access-control` and `src/lib/access-context`: role-based access state and UI context.
- `src/lib/reports`: report row builders, indexes, exports, and view models.
- `src/components/layout/app-shell.tsx`: navigation, mobile restrictions, admin simulation, and data status indicator.
- `src/components/auth/auth-gate.tsx`: login, first access, password reset, and access simulation UI.
- `src/components/organization`: the validated organogram implementation and
  its reusable `PersonCard`.

## Component Hierarchy

- `RootLayout` wraps the app with `AuthGate`, `DeliveryStoreProvider`, and `AppShell`.
- `AuthGate` handles authentication state, password flows, and access simulation.
- `AccessContextProvider` exposes effective access user, admin flags, and simulation controls.
- `AppShell` provides sidebar navigation, header, restricted views, and route gating.
- Domain pages compose feature components under `AppShell`.
- Shared UI primitives live in `src/components/ui` and are reused across domains.

## Routing Flow

- Next.js App Router drives navigation from `src/app`.
- `AppShell` reads `usePathname` and `useSearchParams` to determine active route and mobile/admin restrictions.
- Mobile-only restrictions redirect to `MobileRestrictedView`.
- Hunter-consult restrictions redirect to `RestrictedAccessView`.
- Admin simulation is stored in localStorage and applied via `AccessContextProvider`.
- API routes under `/api/delivery/*` are command handlers protected by bearer token and app access validation.

## State Management

- `DeliveryStoreProvider` is the main client state container.
- It initializes from the selected repository and exposes CRUD methods for people, customers, targets, areas, subjects, baselines, and compensations.
- After mutations, the store refreshes full `DeliveryData` from the repository or applies optimistic local updates for delete flows.
- `useDeliveryStore` is the primary consumer hook.
- `AccessContext` manages effective access user, admin/editor flags, and simulation state.

## Data Flow

- UI components call `useDeliveryStore` for data and mutations.
- Store delegates reads and writes to `DeliveryRepository`.
- `createDeliveryRepositorySelection` chooses `supabase`, `local-dev`, or `unavailable`.
- In production without Supabase, the app blocks with a configuration error.
- Critical writes flow through `/api/delivery/*` route handlers, which validate session, access role, and schema before calling `SupabaseDeliveryRepository`.
- The Supabase adapter uses RPCs and table operations with RLS enforcement.
- Derived data such as area usages, customer totals, and studio rollups are computed in `src/lib`.

## Supabase Integration Points

- `src/lib/supabase/client.ts`: singleton browser client with session persistence and production RLS warning.
- `src/lib/repositories/supabaseDeliveryRepository.ts`: main persistence adapter.
- `src/lib/repositories/accessRepository.ts`: access user administration via RPCs.
- `src/server/auth/delivery-command-access.ts`: server-side bearer validation and `accept_current_app_access` RPC.
- `supabase/migrations`: schema, RLS, triggers, and performance indexes.
- Server API routes instantiate `SupabaseDeliveryRepository` with the request-scoped Supabase client.

## Reusable Hooks

- `src/hooks/use-set-selection.ts`: generic Set-based selection state with toggle, selectAll, clear, and has.
- `src/hooks/use-person-target-report-controller.ts`: report filters, sorting, view switching, and row derivation for person target reports.
- `src/lib/use-close-on-navigation.ts`: cleanup utility for dialogs/previews on navigation.

## Providers

- `DeliveryStoreProvider`: top-level client data store and CRUD facade.
- `AccessContextProvider`: effective access user and role flags.
- `AuthGate`: authentication gate with login, first access, reset, and simulation.
- `AppShell`: layout provider with navigation, mobile/admin restrictions, and error notices.

## Utility Modules

- `src/lib/validation.ts`: Zod schemas for people, customers, areas, targets, and subjects.
- `src/lib/roles.ts`: role classification, hierarchy levels, and translation.
- `src/lib/access-control.ts`: access user model, email normalization, role translation, and hunter consult scope.
- `src/lib/export.ts`: browser-side PNG/PDF/CSV/Excel export utilities.
- `src/lib/customer-target-total.ts`: canonical customer total target calculation.
- `src/lib/studio-renewal-rollup.ts`: studio renewal eligibility and target derivation.
- `src/lib/coverage-sync.ts`: coverage assignment building and application.
- `src/lib/area-usage.ts`: area usage metrics from people coverage.
- `src/lib/financial-customers.ts`: financial customer metrics.
- `src/lib/lifecycle.ts`: lifecycle status normalization.
- `src/lib/director-governance.ts`: director governance constants and rules.
- `src/lib/report-export.ts`: report export configuration.
- `src/lib/rate-limit.ts`: API rate limiting.

## Current Technical Debt Observed

- `src/data/mockData.ts` remains a large in-memory seed despite Supabase being the production target.
- `LocalDeliveryRepository` still carries significant business logic that should ideally move to domain services or server commands.
- Some UI components embed domain-derived calculations instead of consuming precomputed values from the store or view models.
- The organogram source of truth is `src/components/organization/organization-chart.tsx`.
  The obsolete V2 implementation and its dedicated cards/hooks were removed;
  do not reintroduce a parallel organization chart path.
- Access simulation is UI-only and stored in localStorage; backend authorization must remain authoritative.
- Several report and export utilities are browser-only, which limits reuse from server-rendered contexts.
- Baseline and snapshot imports mix local fallback data with Supabase persistence, creating potential drift if migrations are not applied.
