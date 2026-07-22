import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const command = process.argv[2] ?? "check";
const targetEnvironment = process.argv[3] ?? "production";

const requiredVariables = [
  {
    name: "OPENAI_API_KEY",
    value: process.env.OPENAI_API_KEY,
    required: true,
  },
  {
    name: "AI_MODEL",
    value: process.env.AI_MODEL || "gpt-5.5",
    required: false,
  },
  {
    name: "AI_MAX_TOKENS",
    value: process.env.AI_MAX_TOKENS || "900",
    required: false,
  },
  {
    name: "AI_TEMPERATURE",
    value: process.env.AI_TEMPERATURE || "0.2",
    required: false,
  },
];

if (!["check", "sync"].includes(command)) {
  console.error("Usage: node scripts/vercel-ai-env.mjs check|sync [production|preview|development]");
  process.exit(1);
}

const existing = listVercelEnv(targetEnvironment);
const missing = requiredVariables.filter((variable) => !existing.has(variable.name));
const missingLocalRequired = requiredVariables.filter((variable) => variable.required && !variable.value?.trim());

if (missingLocalRequired.length) {
  console.error([
    "AI env check failed:",
    ...missingLocalRequired.map((variable) => `- ${variable.name} is missing locally; value was not printed.`),
  ].join("\n"));
  process.exit(1);
}

if (command === "check") {
  report(existing, missing, targetEnvironment);
  process.exit(missing.length ? 1 : 0);
}

if (!missing.length) {
  report(existing, missing, targetEnvironment);
  process.exit(0);
}

for (const variable of missing) {
  addVercelEnv(variable.name, variable.value ?? "", targetEnvironment);
}

const refreshed = listVercelEnv(targetEnvironment);
const stillMissing = requiredVariables.filter((variable) => !refreshed.has(variable.name));
report(refreshed, stillMissing, targetEnvironment);
process.exit(stillMissing.length ? 1 : 0);

function listVercelEnv(environment) {
  const result = runVercel(["env", "ls", environment]);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const names = new Set();
  for (const variable of requiredVariables) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(variable.name)}\\s+Encrypted\\s+`, "m");
    if (pattern.test(output)) names.add(variable.name);
  }
  return names;
}

function addVercelEnv(name, value, environment) {
  if (!value.trim()) {
    throw new Error(`${name} has no local value to sync.`);
  }

  console.log(`Adding ${name} to Vercel ${environment}. Value was not printed.`);
  runVercel(["env", "add", name, environment, "--value", value, "--yes"]);
}

function runVercel(args) {
  const result = spawnSync(process.execPath, ["scripts/vercel-cli.mjs", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, VERCEL_CLI_STDIO: "pipe" },
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }

  return result;
}

function report(existing, missing, environment) {
  console.log(`AI env status for Vercel ${environment}:`);
  for (const variable of requiredVariables) {
    console.log(`- ${variable.name}: ${existing.has(variable.name) ? "present" : "missing"}`);
  }
  if (missing.length) {
    console.log("Missing variables must be added before generative AI can run in this environment.");
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
