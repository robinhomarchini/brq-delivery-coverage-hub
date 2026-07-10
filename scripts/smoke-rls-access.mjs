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
];

const profiles = [
  { key: "VIEWER", expectedRole: "viewer", active: true, canAdmin: false, canEdit: false },
  { key: "EDITOR", expectedRole: "editor", active: true, canAdmin: false, canEdit: true },
  { key: "ADMIN", expectedRole: "admin", active: true, canAdmin: true, canEdit: true },
  { key: "BLOCKED", expectedRole: null, active: false, canAdmin: false, canEdit: false },
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
  console.log(`RLS smoke skipped: ${reason}.`);
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
    } else if (accessData.role !== profile.expectedRole || accessData.active !== true) {
      fail(`${label}: expected active ${profile.expectedRole}, got role=${accessData.role} active=${accessData.active}`);
    }
  } else if (accessData?.active === true) {
    fail(`${label}: blocked user resolved as active.`);
  }

  await assertAdminRpcBoundary(client, profile);
  await assertEditRpcBoundary(client, profile);
  await client.auth.signOut();
}

if (failed) {
  process.exit(1);
}

console.log(`RLS smoke checks passed for ${configuredProfiles.map((profile) => profile.key.toLowerCase()).join(", ")}.`);

async function assertAdminRpcBoundary(client, profile) {
  const { error } = await client.rpc("list_app_access");
  if (profile.canAdmin && error) {
    fail(`${profile.key.toLowerCase()}: admin RPC should be allowed: ${error.message}`);
  }
  if (!profile.canAdmin && !isPermissionError(error)) {
    fail(`${profile.key.toLowerCase()}: admin RPC should be denied, got ${error?.message ?? "success"}`);
  }
}

async function assertEditRpcBoundary(client, profile) {
  const { error } = await client.rpc("save_specialist_hunter_studio_assignments", {
    p_person_id: "__rls-smoke-person__",
    p_customer_id: "__rls-smoke-customer__",
    p_target_year: 2026,
    p_studio_target_allocation_ids: [],
  });

  if (profile.canEdit) {
    if (!error) {
      fail(`${profile.key.toLowerCase()}: edit RPC unexpectedly succeeded with invalid smoke IDs.`);
    } else if (isPermissionError(error)) {
      fail(`${profile.key.toLowerCase()}: edit RPC should pass authorization and fail validation, got permission error: ${error.message}`);
    }
    return;
  }

  if (!isPermissionError(error)) {
    fail(`${profile.key.toLowerCase()}: edit RPC should be denied, got ${error?.message ?? "success"}`);
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
