# Security and RLS review

- [ ] Separate business role, application permission, and database authorization.
- [ ] Identify caller, tenant/business scope, ownership, and trust boundary.
- [ ] Verify table RLS policies and view behavior for anonymous, authenticated,
      privileged, and service-role paths.
- [ ] Review grants and revoke unnecessary table/function/schema privileges.
- [ ] Prefer `SECURITY INVOKER`; justify every `SECURITY DEFINER`.
- [ ] For definers, fix a safe `search_path`, schema-qualify references, check
      authorization/scope, restrict `EXECUTE`, and reject unsafe dynamic SQL.
- [ ] Test horizontal/vertical privilege escalation and cross-tenant leakage.
- [ ] Verify RPCs cannot reveal records hidden by RLS.
- [ ] Keep service-role credentials and privileged calls out of clients.
- [ ] Document the threat model, negative tests, residual risks, and evidence.

