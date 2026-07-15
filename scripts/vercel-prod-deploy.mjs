import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const root = process.cwd();
const localAppData = path.join(root, ".vercel-cli", "localappdata");
const npmCache = path.join(root, ".npm-cache");
const authFile = path.join(os.homedir(), ".vercel", "auth.json");
const hasToken = Boolean(process.env.VERCEL_TOKEN?.trim());
const hasAuthFile = fs.existsSync(authFile);

if (!hasToken && !hasAuthFile) {
  console.error([
    "Vercel deploy blocked: no authentication found.",
    "Set VERCEL_TOKEN in a secure environment or run:",
    "npx --cache .npm-cache --yes --package node@22 --package vercel@56.2.0 vercel login",
  ].join("\n"));
  process.exit(1);
}

fs.mkdirSync(localAppData, { recursive: true });
fs.mkdirSync(npmCache, { recursive: true });

const env = {
  ...process.env,
  LOCALAPPDATA: localAppData,
  NPM_CONFIG_CACHE: npmCache,
  VERCEL_TELEMETRY_DISABLED: "1",
  NO_UPDATE_NOTIFIER: "1",
};

const args = [
  "--cache",
  ".npm-cache",
  "--yes",
  "--package",
  "node@22",
  "--package",
  "vercel@56.2.0",
  "vercel",
  "deploy",
  "--prod",
  "--yes",
  "--force",
  "--archive",
  "tgz",
  "--no-wait",
];

const result = spawnSync("npx", args, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
