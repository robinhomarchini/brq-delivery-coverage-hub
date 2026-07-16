import { spawnSync } from "node:child_process";

const args = [
  "scripts/vercel-cli.mjs",
  "deploy",
  "--prod",
  "--yes",
  "--force",
  "--archive",
  "tgz",
  "--no-wait",
];

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  stdio: "inherit",
});

process.exit(result.status ?? 1);
