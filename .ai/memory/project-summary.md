# Project Summary

BRQ Delivery Coverage Hub is an internal executive web app built with Next.js App Router, React, TypeScript, Tailwind CSS, Supabase/Postgres and Vercel.

The application keeps domain data access behind repository contracts in `src/lib/repositories`. Supabase is the current production backend; local repositories exist for development and contract testing only.

Critical domain areas include customer targets, person targets, areas/studios targets, reports/exports, baseline comparisons, authentication, authorization, RLS/RBAC and transactional persistence flows.
