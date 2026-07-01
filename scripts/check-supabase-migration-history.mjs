import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const localVersions = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .map((name) => name.slice(0, 14))
  .sort();

const remoteVersions = getRemoteMigrationVersions();
const missingRemote = localVersions.filter((version) => !remoteVersions.includes(version));
const extraRemote = remoteVersions.filter((version) => !localVersions.includes(version));

console.log(`Local migrations:  ${localVersions.length}`);
console.log(`Remote migrations: ${remoteVersions.length}`);

if (!missingRemote.length && !extraRemote.length) {
  console.log("Supabase migration history is aligned.");
  process.exit(0);
}

if (missingRemote.length) {
  console.error("\nLocal migrations missing from remote history:");
  for (const version of missingRemote) {
    console.error(`- ${version}`);
  }
}

if (extraRemote.length) {
  console.error("\nRemote migration history contains versions without local files:");
  for (const version of extraRemote) {
    console.error(`- ${version}`);
  }
}

console.error("\nDo not auto-repair blindly. Confirm the remote schema first, then run:");
console.error("npx supabase migration repair --linked --status applied <version...>");
process.exit(1);

function getRemoteMigrationVersions() {
  const args = ["supabase", "migration", "list"];

  if (process.env.SUPABASE_DB_URL) {
    args.push("--db-url", process.env.SUPABASE_DB_URL);
  } else {
    args.push("--linked");
  }

  const env = {
    ...process.env,
    NO_COLOR: "1",
    DO_NOT_TRACK: "1",
    SUPABASE_TELEMETRY_DISABLED: "1",
  };

  if (process.env.SUPABASE_MIGRATION_CHECK_NPM_CACHE) {
    env.npm_config_cache = process.env.SUPABASE_MIGRATION_CHECK_NPM_CACHE;
    env.NPM_CONFIG_CACHE = process.env.SUPABASE_MIGRATION_CHECK_NPM_CACHE;
  }

  const output = runSupabaseMigrationListWithRetry(args, env);
  return parseRemoteMigrationVersions(output);
}

function runSupabaseMigrationListWithRetry(args, env) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return process.platform === "win32"
        ? execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ["npx", ...args].map(quotePowerShellArgument).join(" ")], {
          encoding: "utf8",
          env,
          stdio: ["ignore", "pipe", "pipe"],
        })
        : execFileSync("npx", args, {
          encoding: "utf8",
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
    } catch (error) {
      const output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
      const versions = parseRemoteMigrationVersions(output, false);
      if (versions.length) return output;
      lastError = error;
      console.warn(`Supabase migration list attempt ${attempt} failed; ${attempt < 3 ? "retrying" : "giving up"}.`);
    }
  }

  throw lastError;
}

function parseRemoteMigrationVersions(output, throwOnUnexpected = true) {
  const jsonStart = output.indexOf("{");
  const jsonEnd = output.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd >= jsonStart) {
    try {
      const payload = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
      const rows = Array.isArray(payload.migrations) ? payload.migrations : [];
      return rows
        .map((row) => String(row.remote ?? ""))
        .filter(Boolean)
        .sort();
    } catch {
      // Some CLI/npm failures include JavaScript-like object fragments. Fall
      // through to table parsing before reporting an unexpected response.
    }
  }

  const versions = Array.from(output.matchAll(/`\s*(\d{14})\s*`\s*\|\s*`\s*(\d{14})\s*`/g))
    .map((match) => match[2])
    .sort();
  if (versions.length) return versions;

  if (throwOnUnexpected) throw new Error(`Supabase CLI returned an unexpected response:\n${output}`);
  return [];
}

function quotePowerShellArgument(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "''")}'`;
}
