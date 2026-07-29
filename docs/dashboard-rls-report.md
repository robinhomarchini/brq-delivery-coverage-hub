# Dashboard RLS Security Validation

Date: 2026-07-29
Scope: dashboard metric layer, views, RPCs, repository integration
Status: offline validations enforced; live negative tests require provisioned RLS smoke users

## Scenarios Covered

1. Hunter requests another customer's data
   - Test: `get_executive_dashboard_summary` with arbitrary hunter customer IDs
   - Expected: filtered/empty result, never unauthorized data
   - Script: `scripts/verify-dashboard-rls-security.mjs` -> `hunter_scope_arbitrary_ids`

2. Hunter sends `hunterScopeEnabled=false`
   - Test: RPC called with `p_hunter_scope_enabled=false` and arbitrary IDs
   - Expected: no privilege escalation; authorization remains enforced
   - Script: same path as scenario 1; repo no longer treats client params as auth source

3. Hunter sends arbitrary customer IDs
   - Test: synthetic UUIDs in `p_hunter_customer_ids`
   - Expected: empty or scoped result
   - Script: `hunter_scope_arbitrary_ids`

4. Viewer attempts editor operation
   - Test: `save_person_with_assignments` RPC as viewer
   - Expected: permission denied
   - Script: `editor_boundary`

5. Blocked user
   - Test: dashboard RPCs with inactive app access
   - Expected: denied
   - Script: `dashboard_summary_blocked`, `dashboard_performance_blocked`, `direct_view_blocked`, `hunter_scope_blocked`

6. Admin
   - Test: dashboard RPCs as admin
   - Expected: full access
   - Script: active profile assertions

7. Anonymous
   - Test: dashboard RPC without session
   - Expected: denied
   - Script: `dashboard_summary_anon`

8. Dashboard RPCs
   - `get_executive_dashboard_summary`
   - `get_dashboard_performance_by_customer`
   - Future dashboard RPCs should reuse the same authorization boundary
   - Script: `dashboard_summary_active`, `dashboard_performance_active`

9. View / RPC / underlying table RLS equivalence
   - View: `vw_customer_dashboard_metrics` with `security_invoker = true`
   - RPCs: `security invoker`, `set search_path = public`
   - Tables: RLS enabled on all underlying tables
   - Script: `direct_view_active`

10. Reconciliation
    - Confirmed: view and RPCs use caller context
    - Confirmed: no `SECURITY DEFINER` in dashboard path
    - Confirmed: no direct `.from("vw_customer_dashboard_metrics")` from `src/`
    - Offline checks now enforce `security_invoker`, `search_path`, and `board_approved` filter presence

## Files

- `scripts/verify-dashboard-rls-security.mjs`
- `supabase/migrations/20260729203300_set_dashboard_view_security_invoker.sql`
- `supabase/migrations/20260729210000_grant_dashboard_view_select.sql`

## Execution

```bash
# offline validations only
node scripts/verify-dashboard-rls-security.mjs

# provision smoke users (requires confirmation and service role key)
RLS_SMOKE_PROVISION_CONFIRM=provision-rls-smoke-users npm run smoke:rls:provision

# run full dashboard RLS validation
npm run smoke:rls:security

# run full RLS suite
npm run smoke:rls
```

## Remaining Gaps

- Full negative-path execution still depends on provisioned test users; without them, offline assertions run and live paths are skipped
- Board baseline exposure should still be verified against board_approved filter on production-like data
- Hunter scope negative tests should use real assigned-customer data to confirm intersection behavior
