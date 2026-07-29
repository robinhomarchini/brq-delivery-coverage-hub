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

if (!url || !anonKey || configuredProfiles.length === 0) {
  const missingBase = [
    ["NEXT_PUBLIC_SUPABASE_URL", url],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ].filter(([, value]) => !value).map(([name]) => name);
  const reason = missingBase.length > 0
    ? `missing ${missingBase.join(", ")}`
    : `missing test users such as ${requiredProfileEnvNames.join(", ")}`;
  console.log(`Dashboard RLS security validation skipped: ${reason}.`);
  process.exit(0);
}

let failed = false;
const report = [];

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
    report.push({ profile: label, scenario: "auth", pass: false, detail: signInError?.message ?? "missing session" });
    continue;
  }

  const { data: accessData, error: accessError } = await client.rpc("accept_current_app_access").maybeSingle();
  if (profile.active) {
    if (accessError || !accessData) {
      fail(`${label}: active user could not resolve app access: ${accessError?.message ?? "missing access row"}`);
      report.push({ profile: label, scenario: "app_access", pass: false, detail: accessError?.message ?? "missing access row" });
      continue;
    }
    if (accessData.role !== profile.expectedRole || accessData.active !== true) {
      fail(`${label}: expected active ${profile.expectedRole}, got role=${accessData.role} active=${accessData.active}`);
      report.push({ profile: label, scenario: "app_access", pass: false, detail: `role=${accessData.role} active=${accessData.active}` });
      continue;
    }
  } else if (accessData?.active === true) {
    fail(`${label}: blocked user resolved as active.`);
    report.push({ profile: label, scenario: "app_access", pass: false, detail: "blocked user resolved as active" });
    continue;
  }

  report.push({ profile: label, scenario: "auth", pass: true, detail: "authenticated" });
  report.push({ profile: label, scenario: "app_access", pass: true, detail: `role=${accessData?.role ?? "n/a"} active=${accessData?.active ?? "n/a"}` });

  await assertDashboardRpc(client, profile);
  await assertHunterScopeBoundary(client, profile);
  await assertPerformanceRpc(client, profile);
  await assertDirectViewAccess(client, profile);
  await assertEditorBoundary(client, profile);
  await assertAnonymousBlocked(client);

  await client.auth.signOut();
}

if (failed) {
  console.log("\n=== DASHBOARD RLS SECURITY REPORT ===");
  for (const entry of report) {
    console.log(`${entry.pass ? "PASS" : "FAIL"}\t${entry.profile}\t${entry.scenario}\t${entry.detail}`);
  }
  console.log("=== END REPORT ===\n");
  process.exit(1);
}

console.log("All dashboard RLS security checks passed.");
process.exit(0);

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
      report.push({ profile: label, scenario: "dashboard_summary_blocked", pass: false, detail: "allowed" });
    } else {
      report.push({ profile: label, scenario: "dashboard_summary_blocked", pass: true, detail: error.message });
    }
    return;
  }

  if (error) {
    fail(`${label}: dashboard RPC should be allowed for active users: ${error.message}`);
    report.push({ profile: label, scenario: "dashboard_summary_active", pass: false, detail: error.message });
    return;
  }

  const summary = data?.summary ?? {};
  const financialByCustomer = Array.isArray(data?.financialByCustomer) ? data.financialByCustomer : [];

  if (!Number.isFinite(summary.totalTarget)) {
    fail(`${label}: dashboard RPC returned invalid totalTarget.`);
  }
  if (!Number.isFinite(summary.customerCount)) {
    fail(`${label}: dashboard RPC returned invalid customerCount.`);
  }
  if (!Number.isInteger(summary.activePeopleCount) || summary.activePeopleCount < 0) {
    fail(`${label}: dashboard RPC returned invalid activePeopleCount.`);
  }
  if (!Number.isInteger(summary.directorCount) || summary.directorCount < 0) {
    fail(`${label}: dashboard RPC returned invalid directorCount.`);
  }
  if (!Number.isInteger(summary.managerCount) || summary.managerCount < 0) {
    fail(`${label}: dashboard RPC returned invalid managerCount.`);
  }
  if (Array.isArray(financialByCustomer) && financialByCustomer.length > 10) {
    fail(`${label}: dashboard RPC returned more than 10 financial rows.`);
  }

  const pass = Number.isFinite(summary.totalTarget)
    && Number.isFinite(summary.customerCount)
    && Number.isInteger(summary.activePeopleCount)
    && Number.isInteger(summary.directorCount)
    && Number.isInteger(summary.managerCount)
    && (!Array.isArray(financialByCustomer) || financialByCustomer.length <= 10);

  report.push({ profile: label, scenario: "dashboard_summary_active", pass, detail: `totalTarget=${summary.totalTarget} customers=${summary.customerCount}` });
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
      report.push({ profile: label, scenario: "dashboard_performance_blocked", pass: false, detail: "allowed" });
    } else {
      report.push({ profile: label, scenario: "dashboard_performance_blocked", pass: true, detail: error.message });
    }
    return;
  }

  if (error) {
    fail(`${label}: performance RPC should be allowed for active users: ${error.message}`);
    report.push({ profile: label, scenario: "dashboard_performance_active", pass: false, detail: error.message });
    return;
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length > 100) {
    fail(`${label}: performance RPC returned too many rows.`);
  }

  report.push({ profile: label, scenario: "dashboard_performance_active", pass: true, detail: `items=${items.length}` });
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
      report.push({ profile: label, scenario: "hunter_scope_blocked", pass: false, detail: "allowed" });
    } else {
      report.push({ profile: label, scenario: "hunter_scope_blocked", pass: true, detail: unrestrictedError.message });
    }
    return;
  }

  if (profile.expectedRole === "hunter_viewer") {
    if (unrestrictedError) {
      report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: true, detail: unrestrictedError.message });
    } else if (unrestricted && typeof unrestricted.summary === "object") {
      const customerCount = Number(unrestricted.summary.customerCount ?? 0);
      if (customerCount > 0) {
        fail(`${label}: hunter scope with arbitrary IDs must not reveal unauthorized customers.`);
        report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: false, detail: `customerCount=${customerCount}` });
      } else {
        report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: true, detail: "filtered to zero" });
      }
    } else {
      report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: true, detail: "no data" });
    }
    return;
  }

  if (unrestrictedError) {
    fail(`${label}: non-hunter active user should not be forced into hunter scope failure: ${unrestrictedError.message}`);
    report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: false, detail: unrestrictedError.message });
  } else if (unrestricted && typeof unrestricted.summary === "object") {
    const customerCount = Number(unrestricted.summary.customerCount ?? 0);
    const totalTarget = Number(unrestricted.summary.totalTarget ?? 0);
    if (customerCount === 0 && totalTarget === 0) {
      report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: true, detail: "empty result" });
    } else {
      fail(`${label}: arbitrary hunter customer IDs must not increase visibility.`);
      report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: false, detail: `customerCount=${customerCount}` });
    }
  } else {
    report.push({ profile: label, scenario: "hunter_scope_arbitrary_ids", pass: true, detail: "no data" });
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
      report.push({ profile: label, scenario: "direct_view_blocked", pass: false, detail: "allowed" });
    } else {
      report.push({ profile: label, scenario: "direct_view_blocked", pass: true, detail: error.message });
    }
    return;
  }

  if (error) {
    fail(`${label}: direct view access should be allowed for active users: ${error.message}`);
    report.push({ profile: label, scenario: "direct_view_active", pass: false, detail: error.message });
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  report.push({ profile: label, scenario: "direct_view_active", pass: true, detail: `rows=${rows.length}` });
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
      report.push({ profile: label, scenario: "editor_boundary", pass: false, detail: "unexpected success" });
    } else if (isPermissionError(error)) {
      fail(`${label}: editor RPC should pass authorization and fail validation, got permission error: ${error.message}`);
      report.push({ profile: label, scenario: "editor_boundary", pass: false, detail: error.message });
    } else {
      report.push({ profile: label, scenario: "editor_boundary", pass: true, detail: "validation error expected" });
    }
    return;
  }

  if (!isPermissionError(error)) {
    fail(`${label}: editor RPC should be denied, got ${error?.message ?? "success"}`);
    report.push({ profile: label, scenario: "editor_boundary", pass: false, detail: error?.message ?? "success" });
  } else {
    report.push({ profile: label, scenario: "editor_boundary", pass: true, detail: error.message });
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
    report.push({ profile: "anonymous", scenario: "dashboard_summary_anon", pass: false, detail: "allowed" });
  } else {
    report.push({ profile: "anonymous", scenario: "dashboard_summary_anon", pass: true, detail: error.message });
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

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}
