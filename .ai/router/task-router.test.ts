import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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
  mkdirSync(path.join(tempRoot, ".ai", "memory"), { recursive: true });
  writeFileSync(path.join(tempRoot, ".ai", "memory", "stable-facts.md"), "# Stable Facts\n\nLOCAL_AI_MODEL=secret-value\n");
  const secretContext = buildContextPackage({ request: "summarize stable facts", rootDir: tempRoot, maxFiles: 3 });
  assert.ok(
    secretContext.stable_context.every((item) => !item.includes("secret-value")),
    "stable context output must not persist secret values",
  );

  console.log("AI router checks passed.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
