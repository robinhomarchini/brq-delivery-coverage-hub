const target = process.argv[2] ?? "brq-delivery-coverage-hub.vercel.app";
const waitMs = Number.parseInt(process.env.VERCEL_INSPECT_WAIT_MS ?? "15000", 10);
const maxAttempts = Number.parseInt(process.env.VERCEL_INSPECT_ATTEMPTS ?? "6", 10);

let lastStatus = 1;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(process.execPath, ["scripts/vercel-cli.mjs", "inspect", target], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, VERCEL_CLI_STDIO: "pipe" },
  });

  lastStatus = result.status ?? 1;
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (lastStatus !== 0) process.exit(lastStatus);
  if (/status\s+● Ready/i.test(output)) process.exit(0);
  if (/status\s+● (Error|Canceled|Failed)/i.test(output)) process.exit(1);
  if (attempt === maxAttempts) break;

  console.log(`Deployment ainda nao esta Ready. Nova tentativa em ${Math.round(waitMs / 1000)}s (${attempt}/${maxAttempts}).`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

console.error("Deployment nao ficou Ready dentro da janela de inspect configurada.");
process.exit(lastStatus || 1);
