import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const root = process.cwd();
const projectFile = path.join(root, ".vercel", "project.json");
const authFile = path.join(os.homedir(), ".vercel", "auth.json");
const localVercelCacheDir = path.join(root, ".vercel-cli", "localappdata", "com.vercel.cli", "Cache", "package-updates");
const hasToken = Boolean(process.env.VERCEL_TOKEN?.trim());
const hasAuthFile = fs.existsSync(authFile);
const problems = [];
const warnings = [];

if (!fs.existsSync(projectFile)) {
  problems.push("Vercel project is not linked. Missing .vercel/project.json.");
} else {
  const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
  if (!project.projectId || !project.orgId) {
    problems.push("Vercel project link is incomplete. Check .vercel/project.json.");
  }
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (nodeMajor >= 24) {
  warnings.push([
    `Local Node.js is ${process.versions.node}.`,
    "deploy:prod will run Vercel CLI through node@22 from the project npm cache.",
  ].join(" "));
  const node22Check = spawnSync("npx", ["--cache", ".npm-cache", "--yes", "--package", "node@22", "node", "-v"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (node22Check.status !== 0 || !node22Check.stdout.trim().startsWith("v22.")) {
    problems.push("Node 22 fallback is not available through npx. Run `npx --cache .npm-cache --yes --package node@22 node -v` and retry.");
  }
}

if (!hasToken && !hasAuthFile) {
  problems.push([
    "Vercel CLI is not authenticated for this Windows user.",
    "Expected one of:",
    "- VERCEL_TOKEN set in the environment or .env.local; or",
    "- local login at %USERPROFILE%\\.vercel\\auth.json.",
    "",
    "Preferred when auth.json is blocked: add VERCEL_TOKEN to .env.local, then retry deploy.",
    "Alternative: run `npx --cache .npm-cache --yes --package node@22 --package vercel@56.2.0 vercel login` once.",
  ].join("\n"));
}

if (hasToken && /[.-]/.test(process.env.VERCEL_TOKEN.trim())) {
  problems.push([
    "VERCEL_TOKEN is present but does not look like a Vercel CLI/account token.",
    "The Vercel CLI rejects token values containing '-' or '.', which usually means an OIDC/JWT token was saved instead.",
    "Create a Vercel Account Token at https://vercel.com/account/tokens and replace VERCEL_TOKEN in .env.local.",
  ].join(" "));
}

if (hasAuthFile) {
  try {
    const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
    if (!auth.token || typeof auth.token !== "string") {
      problems.push(`Vercel auth file exists but does not contain a usable token: ${authFile}`);
    }
  } catch {
    problems.push(`Vercel auth file is not valid JSON: ${authFile}`);
  }
}

try {
  fs.mkdirSync(localVercelCacheDir, { recursive: true });
  const probeFile = path.join(localVercelCacheDir, `.codex-write-test-${process.pid}.tmp`);
  fs.writeFileSync(probeFile, "ok");
  fs.rmSync(probeFile, { force: true });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  problems.push(`Vercel CLI cache is not writable: ${localVercelCacheDir}. ${message}`);
}

if (!hasToken && hasAuthFile) {
  warnings.push("Using local Vercel login from %USERPROFILE%\\.vercel\\auth.json.");
}
if (hasToken) {
  warnings.push("Using VERCEL_TOKEN from environment. Token value was not printed.");
}

if (problems.length) {
  console.error(["Vercel deploy preflight failed:", ...problems.map((item) => `- ${item}`)].join("\n"));
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
if (warnings.length) {
  console.log(warnings.join("\n"));
}
console.log(`Vercel deploy preflight passed for project ${project.projectName ?? project.projectId}.`);
