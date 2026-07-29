-- Alter dashboard metrics view to use security_invoker
--
-- Makes the view respect the caller's RLS policies instead of the view owner's
-- permissions. This aligns the view behavior with the rest of the system.

alter view public.vw_customer_dashboard_metrics set (security_invoker = true);
