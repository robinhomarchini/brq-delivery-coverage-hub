import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildContextPackage } from "./context-selector";
import { checkLocalModel } from "./local-model-client";
import { classifyDeterministically, loadRoutingRules, routeTask } from "./task-router";

async function run() {
  const rules = loadRoutingRules(process.cwd());

  assert.equal(
    classifyDeterministically("summarize this log and inspect supabase migration", rules).classification,
    "CODEX_CRITICAL",
    "critical keyword must override local-only intent",
  );

  assert.equal(
    classifyDeterministically("change supabase/migrations/20260710103000_studio_maintenance_responsible_person.sql", rules).classification,
    "CODEX_CRITICAL",
    "Supabase migration path must escalate",
  );

  assert.equal(
    classifyDeterministically("something unclear without known words", rules).classification,
    "UNKNOWN",
    "unknown deterministic result should remain UNKNOWN before route escalation",
  );

  const unknownRoute = await routeTask("something unclear without known words", process.cwd(), 3);
  assert.equal(unknownRoute.classification, "CODEX_STANDARD", "unknown tasks must escalate to Codex standard");

  const context = buildContextPackage({ request: "report export official spreadsheet", rootDir: process.cwd(), maxFiles: 2 });
  assert.ok(context.relevant_files.length <= 2, "context selector must honor max file limit");

  const previousEnabled = process.env.LOCAL_AI_ENABLED;
  process.env.LOCAL_AI_ENABLED = "true";
  delete process.env.LOCAL_AI_MODEL;
  const status = await checkLocalModel();
  assert.equal(status.available, false, "local model without LOCAL_AI_MODEL must fail gracefully");
  if (previousEnabled === undefined) {
    delete process.env.LOCAL_AI_ENABLED;
  } else {
    process.env.LOCAL_AI_ENABLED = previousEnabled;
  }

  const tempRoot = mkdtempSync(path.join(tmpdir(), "ai-router-test-"));
  try {
    mkdirSync(path.join(tempRoot, ".ai", "memory"), { recursive: true });
    writeFileSync(path.join(tempRoot, ".ai", "memory", "stable-facts.md"), "# Stable Facts\n\nLOCAL_AI_MODEL=secret-value\n");
    const secretContext = buildContextPackage({ request: "summarize .ai/memory/stable-facts.md", rootDir: tempRoot, maxFiles: 3 });
    assert.deepEqual(secretContext.stable_context, [".ai/memory/stable-facts.md: Stable Facts"], "an eligible selected memory must emit only its heading");
    assert.ok(
      secretContext.stable_context.every((item) => !item.includes("secret-value")),
      "stable context output must not persist secret values",
    );
    mkdirSync(path.join(tempRoot, "src"), { recursive: true });
    mkdirSync(path.join(tempRoot, "logs"), { recursive: true });
    mkdirSync(path.join(tempRoot, "docs", "project"), { recursive: true });
    const write = (file: string, content = "# Context fixture\n") => writeFileSync(path.join(tempRoot, file), content);
    write(".codexignore", "logs/\n*.generated.ts\nprivate.md\n.env*\n!.env.example\n!.env.local\n!.ai/memory/stable-facts.md\n.ai/memory/stable-facts.md\n*.blocked.md\n!allowed.blocked.md\n/root-only.md\n");
    write(".env.local", "DO_NOT_READ=secret-value");
    write(".env.example", "EXAMPLE=");
    write("private.md");
    write("src/report.generated.ts", "throw new Error('ignored');");
    write("logs/report.ts");
    write("allowed.blocked.md");
    write("denied.blocked.md");
    write("root-only.md");
    write("src/root-only.md");
    write("src/usable.ts", "export const usable = true;");
    const externalFile = path.join(tempRoot, "..", `${path.basename(tempRoot)}-external.ts`);
    writeFileSync(externalFile, "export const external = 'external-secret';");
    try {
      const relativeExternal = path.relative(tempRoot, externalFile).replace(/\\/g, "/");
      write("src/report.ts", `import { external } from '../../${path.basename(externalFile)}';\nimport '../private.md';\nimport './report.generated';\nimport './usable';\nexport const report = external;`);
      const result = buildContextPackage({
        rootDir: tempRoot,
        request: `review report src/report.ts private.md src/report.generated.ts logs/report.ts .env.local .env.example allowed.blocked.md denied.blocked.md root-only.md src/root-only.md ${relativeExternal} ${externalFile} .ai/memory/stable-facts.md`,
        maxFiles: 30,
      });
      assert.deepEqual(result.relevant_files.sort(), [".env.example", "allowed.blocked.md", "src/report.ts", "src/root-only.md", "src/usable.ts"].sort(), "one policy must exclude secrets, ignored paths and external references/imports, with ordered negation and rooted patterns");
      const relativeRoot = buildContextPackage({ rootDir: path.relative(process.cwd(), tempRoot), request: "src/report.ts", maxFiles: 30 });
      const absoluteRoot = buildContextPackage({ rootDir: tempRoot, request: "src/report.ts", maxFiles: 30 });
      assert.deepEqual(relativeRoot, absoluteRoot, "relative and absolute project roots must select the same context and dependencies");
      assert.ok(relativeRoot.relevant_files.includes("src/usable.ts"), "relative project roots must resolve eligible imports");
      assert.equal(result.stable_context.length, 0, "ignored stable memory must not be read or emitted");

      // Windows junctions do not require developer-mode symlink privileges.
      const link = path.join(tempRoot, "linked");
      try {
        symlinkSync(path.dirname(externalFile), link, process.platform === "win32" ? "junction" : "dir");
        const linked = buildContextPackage({ rootDir: tempRoot, request: `linked/${path.basename(externalFile)}`, maxFiles: 30 });
        assert.ok(linked.relevant_files.every((file) => !file.startsWith("linked/")), "symlink and junction paths must not escape context boundaries");
      } catch (error) {
        if (!(error instanceof Error && "code" in error && ["EPERM", "EACCES", "ENOTSUP"].includes(String(error.code)))) throw error;
        console.log("Symlink test unavailable on this host.");
      }
    } finally {
      rmSync(externalFile, { force: true });
    }

    const canonical = ["ENGINEERING_STANDARD.md", "AGENTS.md", "docs/project/PROJECT_OVERVIEW.md", "docs/project/CURRENT_STATE.md"];
    canonical.forEach((file) => write(file));
    assert.deepEqual(buildContextPackage({ request: "src/report.ts ".repeat(20), rootDir: tempRoot, maxFiles: 1 }).relevant_files, [canonical[0]], "repeated direct references must not outrank canonical instructions");
    for (const budget of [0, 1, 2, 4]) {
      const selected = buildContextPackage({ request: "report src/report.ts", rootDir: tempRoot, maxFiles: budget });
      assert.deepEqual(selected.relevant_files, canonical.slice(0, budget), "canonical instructions and summaries must precede source within budget");
      assert.deepEqual(selected.stable_context, canonical.slice(0, budget).map((file) => `${file}: Context fixture`));
      assert.ok(selected.stable_context.length <= budget, "stable context must share the file budget");
    }
    assert.equal(buildContextPackage({ request: "report", rootDir: tempRoot, maxFiles: -1 }).relevant_files.length, 0);
    assert.equal(buildContextPackage({ request: "report", rootDir: tempRoot, maxFiles: 1.8 }).relevant_files.length, 1);
    assert.ok(buildContextPackage({ request: "report", rootDir: tempRoot, maxFiles: NaN }).relevant_files.length <= 12);
    assert.ok(buildContextPackage({ request: "report", rootDir: tempRoot, maxFiles: Infinity }).relevant_files.length <= 12);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log("AI router checks passed.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
