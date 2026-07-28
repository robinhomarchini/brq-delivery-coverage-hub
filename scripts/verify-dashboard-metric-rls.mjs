import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const requiredProfileEnvNames = [
  "SUPABASE_RLS_VIEWER_EMAIL",
  "SUPABASE_RLS_EDITOR_EMAIL",
  "SUPABASE_RLS_ADMIN_EMAIL",
];

const profiles = [
  { key: "VIEWER", expectedRole: "viewer", active: true },
  { key: "EDITOR", expectedRole: "editor", active: true },
  { key: "ADMIN", expectedRole: "admin", active: true },
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
  console.log(`Dashboard RLS smoke skipped: ${reason}.`);
  process.exit(0);
}

let failed = false;

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
    continue;
  }

  const { data: accessData, error: accessError } = await client.rpc("accept_current_app_access").maybeSingle();
  if (profile.active) {
    if (accessError || !accessData) {
      fail(`${label}: active user could not resolve app access: ${accessError?.message ?? "missing access row"}`);
      continue;
    }
    if (accessData.role !== profile.expectedRole || accessData.active !== true) {
      fail(`${label}: expected active ${profile.expectedRole}, got role=${accessData.role} active=${accessData.active}`);
      continue;
    }
  } else if (accessData?.active === true) {
    fail(`${label}: blocked user resolved as active.`);
    continue;
  }

  await assertDashboardRpc(client, profile);
  await client.auth.signOut();
}

if (failed) {
  process.exit(1);
}

console.log(`Dashboard RPC smoke checks passed for ${configuredProfiles.map((profile) => profile.key.toLowerCase()).join(", ")}.`);

async function assertDashboardRpc(client, profile) {
  const { data, error } = await client.rpc("get_executive_dashboard_summary", {
    p_target_year: 2026,
    p_include_new_logos: false,
    p_hunter_scope_enabled: false,
    p_hunter_customer_ids: [],
    p_hunter_person_id: null,
  });

  if (error) {
    fail(`${profile.key.toLowerCase()}: dashboard RPC should be allowed for active users: ${error.message}`);
    return;
  }

  if (!data || typeof data !== "object") {
    fail(`${profile.key.toLowerCase()}: dashboard RPC returned unexpected payload.`);
    return;
  }

  const summary = data.summary ?? {};
  const financialByCustomer = Array.isArray(data.financialByCustomer) ? data.financialByCustomer : [];

  assertNumber(`${profile.key.toLowerCase()}: totalTarget`, summary.totalTarget);
  assertNumber(`${profile.key.toLowerCase()}: boardTotalTarget`, summary.boardTotalTarget);
  assertNumber(`${profile.key.toLowerCase()}: customerCount`, summary.customerCount);
  assertNumber(`${profile.key.toLowerCase()}: activePeopleCount`, summary.activePeopleCount);
  assertNumber(`${profile.key.toLowerCase()}: directorCount`, summary.directorCount);
  assertNumber(`${profile.key.toLowerCase()}: managerCount`, summary.managerCount);

  if (!Number.isFinite(summary.totalTarget) || summary.totalTarget <= 0) {
    fail(`${profile.key.toLowerCase()}: expected positive totalTarget, got ${summary.totalTarget}`);
  }

  if (!Number.isFinite(summary.customerCount) || summary.customerCount <= 0) {
    fail(`${profile.key.toLowerCase()}: expected positive customerCount, got ${summary.customerCount}`);
  }

  if (!Number.isInteger(summary.activePeopleCount) || summary.activePeopleCount < 0) {
    fail(`${profile.key.toLowerCase()}: expected non-negative integer activePeopleCount, got ${summary.activePeopleCount}`);
  }

  if (!Number.isInteger(summary.directorCount) || summary.directorCount < 0) {
    fail(`${profile.key.toLowerCase()}: expected non-negative integer directorCount, got ${summary.directorCount}`);
  }

  if (!Number.isInteger(summary.managerCount) || summary.managerCount < 0) {
    fail(`${profile.key.toLowerCase()}: expected non-negative integer managerCount, got ${summary.managerCount}`);
  }

  if (summary.activePeopleCount < summary.directorCount + summary.managerCount) {
    fail(`${profile.key.toLowerCase()}: activePeopleCount should be >= directorCount + managerCount.`);
  }

  if (financialByCustomer.length > 10) {
    fail(`${profile.key.toLowerCase()}: financialByCustomer should be limited to 10 rows.`);
  }
}

function assertNumber(label, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label}: expected finite number, got ${value}`);
  }
}

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}
