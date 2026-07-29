import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const requiredProfileEnvNames = [
  "SUPABASE_RLS_VIEWER_EMAIL",
  "SUPABASE_RLS_EDITOR_EMAIL",
  "SUPABASE_RLS_ADMIN_EMAIL",
  "SUPABASE_RLS_BLOCKED_EMAIL",
  "SUPABASE_RLS_HUNTER_EMAIL",
];

const profiles = [
  { key: "VIEWER", expectedRole: "viewer", active: true, canAdmin: false, canEdit: false },
  { key: "EDITOR", expectedRole: "editor", active: true, canAdmin: false, canEdit: true },
  { key: "ADMIN", expectedRole: "admin", active: true, canAdmin: true, canEdit: true },
  { key: "BLOCKED", expectedRole: null, active: false, canAdmin: false, canEdit: false },
  { key: "HUNTER", expectedRole: "hunter_viewer", active: true, canAdmin: false, canEdit: false },
];

const configuredProfiles = profiles
  .map((profile) => ({
    ...profile,
    email: process.env[`SUPABASE_RLS_${profile.key}_EMAIL`],
    password: process.env[`SUPABASE_RLS_${profile.key}_PASSWORD`],
  }))
  .filter((profile) => profile.email && profile.password);

let failed = false;
const report = [];

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function addReport(profile, scenario, pass, detail) {
  report.push({ profile, scenario, pass, detail });
}

if (!url || !anonKey) {
  console.log("Dashboard RLS security validation skipped: missing Supabase URL/anon key.");
  runOfflineValidations();
  printReport();
  process.exit(failed ? 1 : 0);
}

if (configuredProfiles.length === 0) {
  console.log(`Dashboard RLS security validation skipped: missing test users such as ${requiredProfileEnvNames.join(", ")}.`);
  runOfflineValidations();
  printReport();
  process.exit(failed ? 1 : 0);
}

for (const profile of configuredProfiles) {
  const label = profile.key.toLowerCase();
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: profile.email,
    password: profile.password,
  });
  if (signInError || !signInData.session) {
    fail(`${label}: sign-in failed: ${signInError?.message ?? "missing session"}`);
    addReport(label, "auth", false, signInError?.message ?? "missing session");
    continue;
  }

  const { data: accessData, error: accessError } = await client.rpc("accept_current_app_access").maybeSingle();
  if (profile.active) {
    if (accessError || !accessData) {
      fail(`${label}: active user could not resolve app access: ${accessError?.message ?? "missing access row"}`);
      addReport(label, "app_access", false, accessError?.message ?? "missing access row");
      continue;
    }
    if (accessData.role !== profile.expectedRole || accessData.active !== true) {
      fail(`${label}: expected active ${profile.expectedRole}, got role=${accessData.role} active=${accessData.active}`);
      addReport(label, "app_access", false, `role=${accessData.role} active=${accessData.active}`);
      continue;
    }
  } else if (accessData?.active === true) {
    fail(`${label}: blocked user resolved as active.`);
    addReport(label, "app_access", false, "blocked user resolved as active");
    continue;
  }

  addReport(label, "auth", true, "authenticated");
  addReport(label, "app_access", true, `role=${accessData?.role ?? "n/a"} active=${accessData?.active ?? "n/a"}`);

  await assertDashboardRpc(client, profile);
  await assertHunterScopeBoundary(client, profile);
  await assertPerformanceRpc(client, profile);
  await assertDirectViewAccess(client, profile);
  await assertEditorBoundary(client, profile);
  await assertAnonymousBlocked(client);

  await client.auth.signOut();
}

runOfflineValidations();
printReport();
process.exit(failed ? 1 : 0);

async function assertDashboardRpc(client, profile) {
  const { data, error } = await client.rpc("get_executive_dashboard_summary", {
    p_target_year: 2026,
    p_include_new_logos: false,
    p_hunter_scope_enabled: false,
    p_hunter_customer_ids: [],
    p_hunter_person_id: null,
  });

  const label = profile.key.toLowerCase();

  if (!profile.active) {
    if (!error) {
      fail(`${label}: dashboard RPC should be denied for blocked user.`);
      addReport(label, "dashboard_summary_blocked", false, "allowed");
    } else {
      addReport(label, "dashboard_summary_blocked", true, error.message);
    }
    return;
  }

  if (error) {
    fail(`${label}: dashboard RPC should be allowed for active users: ${error.message}`);
    addReport(label, "dashboard_summary_active", false, error.message);
    return;
  }

  const summary = data?.summary ?? {};
  const financialByCustomer = Array.isArray(data?.financialByCustomer) ? data.financialByCustomer : [];

  const pass = Number.isFinite(summary.totalTarget)
    && Number.isFinite(summary.customerCount)
    && Number.isInteger(summary.activePeopleCount)
    && Number.isInteger(summary.directorCount)
    && Number.isInteger(summary.managerCount)
    && (!Array.isArray(financialByCustomer) || financialByCustomer.length <= 10);

  if (!pass) {
    fail(`${label}: dashboard RPC returned invalid summary payload.`);
  }

  addReport(label, "dashboard_summary_active", pass, `totalTarget=${summary.totalTarget} customers=${summary.customerCount}`);
}

async function assertPerformanceRpc(client, profile) {
  const { data, error } = await client.rpc("get_dashboard_performance_by_customer", {
    p_target_year: 2026,
    p_include_new_logos: false,
    p_hunter_scope_enabled: false,
    p_hunter_customer_ids: [],
    p_hunter_person_id: null,
  });

  const label = profile.key.toLowerCase();

  if (!profile.active) {
    if (!error) {
      fail(`${label}: performance RPC should be denied for blocked user.`);
      addReport(label, "dashboard_performance_blocked", false, "allowed");
    } else {
      addReport(label, "dashboard_performance_blocked", true, error.message);
    }
    return;
  }

  if (error) {
    fail(`${label}: performance RPC should be allowed for active users: ${error.message}`);
    addReport(label, "dashboard_performance_active", false, error.message);
    return;
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const pass = items.length <= 100;
  if (!pass) {
    fail(`${label}: performance RPC returned too many rows.`);
  }

  addReport(label, "dashboard_performance_active", pass, `items=${items.length}`);
}

async function assertHunterScopeBoundary(client, profile) {
  const label = profile.key.toLowerCase();

  const { data: unrestricted, error: unrestrictedError } = await client.rpc("get_executive_dashboard_summary", {
    p_target_year: 2026,
    p_include_new_logos: false,
    p_hunter_scope_enabled: true,
    p_hunter_customer_ids: ["00000000-0000-0000-0000-000000000000"],
    p_hunter_person_id: signInData?.session?.user?.id ?? "00000000-0000-0000-0000-000000000000",
  });

  if (!profile.active) {
    if (!unrestrictedError) {
      fail(`${label}: hunter-scoped dashboard RPC should be denied for blocked user.`);
      addReport(label, "hunter_scope_blocked", false, "allowed");
    } else {
      addReport(label, "hunter_scope_blocked", true, unrestrictedError.message);
    }
    return;
  }

  if (profile.expectedRole === "hunter_viewer") {
    if (unrestrictedError) {
      addReport(label, "hunter_scope_arbitrary_ids", true, unrestrictedError.message);
    } else if (unrestricted && typeof unrestricted.summary === "object") {
      const customerCount = Number(unrestricted.summary.customerCount ?? 0);
      if (customerCount > 0) {
        fail(`${label}: hunter scope with arbitrary IDs must not reveal unauthorized customers.`);
        addReport(label, "hunter_scope_arbitrary_ids", false, `customerCount=${customerCount}`);
      } else {
        addReport(label, "hunter_scope_arbitrary_ids", true, "filtered to zero");
      }
    } else {
      addReport(label, "hunter_scope_arbitrary_ids", true, "no data");
    }
    return;
  }

  if (unrestrictedError) {
    fail(`${label}: non-hunter active user should not be forced into hunter scope failure: ${unrestrictedError.message}`);
    addReport(label, "hunter_scope_arbitrary_ids", false, unrestrictedError.message);
  } else if (unrestricted && typeof unrestricted.summary === "object") {
    const customerCount = Number(unrestricted.summary.customerCount ?? 0);
    const totalTarget = Number(unrestricted.summary.totalTarget ?? 0);
    if (customerCount === 0 && totalTarget === 0) {
      addReport(label, "hunter_scope_arbitrary_ids", true, "empty result");
    } else {
      fail(`${label}: arbitrary hunter customer IDs must not increase visibility.`);
      addReport(label, "hunter_scope_arbitrary_ids", false, `customerCount=${customerCount}`);
    }
  } else {
    addReport(label, "hunter_scope_arbitrary_ids", true, "no data");
  }
}

async function assertDirectViewAccess(client, profile) {
  const label = profile.key.toLowerCase();

  const { data, error } = await client
    .from("vw_customer_dashboard_metrics")
    .select("customer_id, customer_name, canonical_total_target")
    .limit(5);

  if (!profile.active) {
    if (!error) {
      fail(`${label}: direct view access should be denied for blocked user.`);
      addReport(label, "direct_view_blocked", false, "allowed");
    } else {
      addReport(label, "direct_view_blocked", true, error.message);
    }
    return;
  }

  if (error) {
    fail(`${label}: direct view access should be allowed for active users: ${error.message}`);
    addReport(label, "direct_view_active", false, error.message);
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  addReport(label, "direct_view_active", true, `rows=${rows.length}`);
}

async function assertEditorBoundary(client, profile) {
  const label = profile.key.toLowerCase();

  const { error } = await client.rpc("save_person_with_assignments", {
    p_id: "__rls-dashboard-smoke__",
    p_name: "Dashboard Smoke",
    p_email: "dashboard-smoke@brq.com",
    p_job_title: "Smoke",
    p_role_type: "Staff",
    p_customer_ids: [],
  });

  if (profile.canEdit) {
    if (!error) {
      fail(`${label}: editor RPC unexpectedly succeeded with smoke payload.`);
      addReport(label, "editor_boundary", false, "unexpected success");
    } else if (isPermissionError(error)) {
      fail(`${label}: editor RPC should pass authorization and fail validation, got permission error: ${error.message}`);
      addReport(label, "editor_boundary", false, error.message);
    } else {
      addReport(label, "editor_boundary", true, "validation error expected");
    }
    return;
  }

  if (!isPermissionError(error)) {
    fail(`${label}: editor RPC should be denied, got ${error?.message ?? "success"}`);
    addReport(label, "editor_boundary", false, error?.message ?? "success");
  } else {
    addReport(label, "editor_boundary", true, error.message);
  }
}

async function assertAnonymousBlocked(client) {
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await anonClient.rpc("get_executive_dashboard_summary", {
    p_target_year: 2026,
    p_include_new_logos: false,
    p_hunter_scope_enabled: false,
    p_hunter_customer_ids: [],
    p_hunter_person_id: null,
  });

  if (!error) {
    fail("anonymous: dashboard RPC should be denied for anonymous users.");
    addReport("anonymous", "dashboard_summary_anon", false, "allowed");
  } else {
    addReport("anonymous", "dashboard_summary_anon", true, error.message);
  }
}

function isPermissionError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "42501"
    || message.includes("permission")
    || message.includes("permissão")
    || message.includes("sem permissão")
    || message.includes("access denied");
}

function printReport() {
  console.log("\n=== DASHBOARD RLS SECURITY REPORT ===");
  for (const entry of report) {
    console.log(`${entry.pass ? "PASS" : "FAIL"}\t${entry.profile}\t${entry.scenario}\t${entry.detail}`);
  }
  console.log("=== END REPORT ===\n");
}

function runOfflineValidations() {
  validateViewSecurityInvoker();
  validateDashboardRpcSecurityInvoker();
  validateBoardApprovedFilter();
  validateSearchPath();
  validateNoDefinerInDashboard();
}

function validateViewSecurityInvoker() {
  const migrationFiles = [
    "supabase/migrations/20260728140000_dashboard_customer_metric_view.sql",
    "supabase/migrations/20260728143000_replace_dashboard_view_and_rpc.sql",
    "supabase/migrations/20260729203300_set_dashboard_view_security_invoker.sql",
  ];

  let viewHasSecurityInvoker = false;
  for (const file of migrationFiles) {
    const content = readMigration(file);
    if (content.includes("security_invoker = true")) {
      viewHasSecurityInvoker = true;
    }
  }

  if (viewHasSecurityInvoker) {
    addReport("offline", "view_security_invoker", true, "vw_customer_dashboard_metrics uses security_invoker = true");
  } else {
    fail("offline: vw_customer_dashboard_metrics missing security_invoker = true");
    addReport("offline", "view_security_invoker", false, "missing security_invoker = true");
  }
}

function validateDashboardRpcSecurityInvoker() {
  const files = [
    "supabase/migrations/20260728140500_dashboard_executive_summary_rpc.sql",
    "supabase/migrations/20260728144000_dashboard_metric_rpc_org_counts.sql",
    "supabase/migrations/20260728144500_dashboard_metric_rpc_org_counts_fix.sql",
    "supabase/migrations/20260728145000_dashboard_performance_by_customer.sql",
  ];

  let rpcsOk = true;
  for (const file of files) {
    const content = readMigration(file);
    if (!content.includes("security invoker")) {
      rpcsOk = false;
      fail(`offline: ${path.basename(file)} missing security invoker`);
    }
    if (!content.includes("set search_path = public")) {
      rpcsOk = false;
      fail(`offline: ${path.basename(file)} missing set search_path = public`);
    }
  }

  addReport("offline", "dashboard_rpc_security_invoker", rpcsOk, rpcsOk ? "all dashboard RPCs use security invoker + search_path" : "missing security invoker/search_path");
}

function validateBoardApprovedFilter() {
  const viewFiles = [
    "supabase/migrations/20260728140000_dashboard_customer_metric_view.sql",
    "supabase/migrations/20260728143000_replace_dashboard_view_and_rpc.sql",
  ];

  let ok = true;
  for (const file of viewFiles) {
    const content = readMigration(file);
    const hasApproved = content.includes("approved = true");
    const hasScenario = content.includes("scenario = 'board_approved'");
    if (!hasApproved || !hasScenario) {
      ok = false;
      fail(`offline: ${path.basename(file)} missing board_approved filter`);
    }
  }

  addReport("offline", "board_approved_filter", ok, ok ? "view restricts board_target_baselines to approved rows" : "missing approved/scenario filter");
}

function validateSearchPath() {
  const files = [
    "supabase/migrations/20260728140500_dashboard_executive_summary_rpc.sql",
    "supabase/migrations/20260728144000_dashboard_metric_rpc_org_counts.sql",
    "supabase/migrations/20260728144500_dashboard_metric_rpc_org_counts_fix.sql",
    "supabase/migrations/20260728145000_dashboard_performance_by_customer.sql",
  ];

  let ok = true;
  for (const file of files) {
    const content = readMigration(file);
    if (!content.includes("set search_path = public")) {
      ok = false;
      fail(`offline: ${path.basename(file)} missing set search_path = public`);
    }
  }

  addReport("offline", "search_path_safety", ok, ok ? "all dashboard RPCs set search_path = public" : "missing search_path");
}

function validateNoDefinerInDashboard() {
  const files = [
    "supabase/migrations/20260728140500_dashboard_executive_summary_rpc.sql",
    "supabase/migrations/20260728144000_dashboard_metric_rpc_org_counts.sql",
    "supabase/migrations/20260728144500_dashboard_metric_rpc_org_counts_fix.sql",
    "supabase/migrations/20260728145000_dashboard_performance_by_customer.sql",
  ];

  let hasDefiner = false;
  for (const file of files) {
    const content = readMigration(file);
    if (/security\s+definer/i.test(content)) {
      hasDefiner = true;
      fail(`offline: ${path.basename(file)} uses SECURITY DEFINER`);
    }
  }

  addReport("offline", "no_security_definer", !hasDefiner, !hasDefiner ? "no SECURITY DEFINER in dashboard RPCs" : "SECURITY DEFINER found");
}

function readMigration(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}
