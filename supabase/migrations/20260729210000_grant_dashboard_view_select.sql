-- Security: make dashboard view access explicit
--
-- vw_customer_dashboard_metrics is consumed through RPCs with
-- security_invoker = true, but explicit SELECT grant makes the intended
-- access path clear and future-proofs direct view usage without weakening RLS.

grant select on public.vw_customer_dashboard_metrics to authenticated;

comment on view public.vw_customer_dashboard_metrics is 'Dashboard metrics view. Access must preserve the approved = true and board_approved filters when querying board_target_baselines. SECURITY INVOKER applies.';
