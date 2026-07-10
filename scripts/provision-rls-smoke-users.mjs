import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmation = process.env.RLS_SMOKE_PROVISION_CONFIRM;

const profiles = [
  { key: "VIEWER", role: "viewer", active: true },
  { key: "EDITOR", role: "editor", active: true },
  { key: "ADMIN", role: "admin", active: true },
  { key: "BLOCKED", role: "viewer", active: false },
];

if (confirmation !== "provision-rls-smoke-users") {
  console.log("RLS smoke user provisioning skipped: set RLS_SMOKE_PROVISION_CONFIRM=provision-rls-smoke-users to run.");
  process.exit(0);
}

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ...profiles.flatMap((profile) => [
    [`SUPABASE_RLS_${profile.key}_EMAIL`, process.env[`SUPABASE_RLS_${profile.key}_EMAIL`]],
    [`SUPABASE_RLS_${profile.key}_PASSWORD`, process.env[`SUPABASE_RLS_${profile.key}_PASSWORD`]],
  ]),
].filter(([, value]) => !value);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

const configuredProfiles = profiles.map((profile) => ({
  ...profile,
  email: process.env[`SUPABASE_RLS_${profile.key}_EMAIL`].trim().toLowerCase(),
  password: process.env[`SUPABASE_RLS_${profile.key}_PASSWORD`],
}));

for (const profile of configuredProfiles) {
  if (!profile.email.endsWith("@brq.com")) {
    console.error(`${profile.key}: smoke users must use a corporate @brq.com email.`);
    process.exit(1);
  }
  if (!isDedicatedSmokeEmail(profile.email)) {
    console.error(`${profile.key}: refusing to provision '${profile.email}'. Use a dedicated test email containing 'smoke', 'rls' or 'teste'.`);
    process.exit(1);
  }
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const profile of configuredProfiles) {
  const user = await ensureAuthUser(profile);
  await ensureAccessRows(user.id, profile);
  console.log(`${profile.key.toLowerCase()}: provisioned ${profile.email} as role=${profile.role} active=${profile.active}.`);
}

console.log("RLS smoke users provisioned. Run npm run smoke:rls to validate the role boundaries.");

async function ensureAuthUser(profile) {
  const existingUser = await findUserByEmail(profile.email);
  if (!existingUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: profile.email,
      password: profile.password,
      email_confirm: true,
      user_metadata: { rls_smoke: true },
    });
    if (error || !data.user) {
      throw new Error(`${profile.key}: could not create auth user: ${error?.message ?? "missing user"}`);
    }
    return data.user;
  }

  const metadata = existingUser.user_metadata ?? {};
  if (metadata.rls_smoke !== true && !isDedicatedSmokeEmail(existingUser.email ?? "")) {
    throw new Error(`${profile.key}: existing auth user does not look like a dedicated smoke account.`);
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
    password: profile.password,
    email_confirm: true,
    user_metadata: { ...metadata, rls_smoke: true },
  });
  if (error || !data.user) {
    throw new Error(`${profile.key}: could not update auth user: ${error?.message ?? "missing user"}`);
  }
  return data.user;
}

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
    page += 1;
  }

  throw new Error("Could not find smoke auth user after scanning 20 pages.");
}

async function ensureAccessRows(userId, profile) {
  const accessRow = {
    email: profile.email,
    role: profile.role,
    active: profile.active,
    updated_at: new Date().toISOString(),
  };

  const { error: inviteError } = await adminClient
    .from("app_access_invites")
    .upsert(accessRow, { onConflict: "email" });
  if (inviteError) {
    throw new Error(`${profile.key}: could not upsert access invite: ${inviteError.message}`);
  }

  const { error: userError } = await adminClient
    .from("app_users")
    .upsert({
      user_id: userId,
      email: profile.email,
      role: profile.role,
      active: profile.active,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  if (userError) {
    throw new Error(`${profile.key}: could not upsert app user: ${userError.message}`);
  }
}

function isDedicatedSmokeEmail(email) {
  const normalized = email.toLowerCase();
  return normalized.includes("smoke") || normalized.includes("rls") || normalized.includes("teste");
}
