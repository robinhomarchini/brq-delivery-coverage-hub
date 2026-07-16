import { spawnSync } from "node:child_process";

const branch = process.argv[2] ?? "main";
const limit = process.argv[3] ?? "5";

const ghExecutable = process.platform === "win32" ? "gh.exe" : "gh";
const auth = spawnSync(ghExecutable, ["auth", "status"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (auth.status !== 0) {
  process.stdout.write(auth.stdout ?? "");
  process.stderr.write(auth.stderr ?? "");
  console.error("GitHub CLI is not authenticated. Run gh auth login/refresh with repo and workflow scopes.");
  process.exit(auth.status ?? 1);
}

const result = spawnSync(ghExecutable, ["run", "list", "--branch", branch, "--limit", limit], {
  cwd: process.cwd(),
  encoding: "utf8",
});

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status !== 0 && /HTTP 404: Not Found/i.test(`${result.stdout}\n${result.stderr}`)) {
  console.error([
    "GitHub Actions runs are not accessible through this gh session/repository API.",
    "This does not block Vercel deployment, but remote quality-gate status must be checked in GitHub UI.",
    "Avoid retrying raw gh run list variants; fix repository/actions access or use GitHub UI logs.",
  ].join("\n"));
}

process.exit(result.status ?? 1);
