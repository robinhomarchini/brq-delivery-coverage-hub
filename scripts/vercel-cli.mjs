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
const vercelArgs = process.argv.slice(2);

if (!vercelArgs.length) {
  console.error("Vercel CLI wrapper requires arguments, for example: node scripts/vercel-cli.mjs inspect <url>");
  process.exit(1);
}

if (!hasToken && !hasAuthFile) {
  console.error([
    "Vercel CLI blocked: no authentication found.",
    "Set VERCEL_TOKEN in .env.production.local/.env.local or run the approved Vercel login flow once.",
    "Do not run npx vercel directly; use npm run deploy:* scripts.",
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
  ...vercelArgs,
];

const npxCliPath = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
const command = fs.existsSync(npxCliPath) ? process.execPath : (process.platform === "win32" ? "npx.cmd" : "npx");
const commandArgs = fs.existsSync(npxCliPath) ? [npxCliPath, ...args] : args;
const result = spawnSync(command, commandArgs, {
  cwd: root,
  env,
  stdio: process.env.VERCEL_CLI_STDIO === "pipe" ? "pipe" : "inherit",
  encoding: process.env.VERCEL_CLI_STDIO === "pipe" ? "utf8" : undefined,
});

if (process.env.VERCEL_CLI_STDIO === "pipe") {
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
}

process.exit(result.status ?? 1);
