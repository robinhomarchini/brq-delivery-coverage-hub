import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./env-loader.mjs";

loadLocalEnv();

const npmCliPath = process.env.npm_execpath;

if (!npmCliPath) {
  console.error("Security check failed: npm_execpath is not available. Run this command through npm.");
  process.exit(1);
}

const commands = [
  ["npm run test:security", [process.execPath, [npmCliPath, "run", "test:security"]]],
  ["npm audit --json", [process.execPath, [npmCliPath, "audit", "--json"]]],
  ["npm run smoke:rls", [process.execPath, [npmCliPath, "run", "smoke:rls"]]],
  ["npm run security:pentest-lite", [process.execPath, [npmCliPath, "run", "security:pentest-lite"]]],
];

for (const [display, [command, args]] of commands) {
  console.log(`\n> ${display}`);

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`Security check failed while running '${display}': ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Security check failed: '${display}' exited with status ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nSecurity check completed successfully.");
