/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), "utf8");
const standard = read("ENGINEERING_STANDARD.md");
const codexProject = JSON.parse(read(".codex", "project.json"));

for (const file of [
  "AGENTS.md",
  "CLAUDE.md",
  path.join(".github", "copilot-instructions.md"),
  path.join(".kilocode", "rules", "00-engineering-standard.md"),
]) {
  const source = read(...file.split(path.sep));
  if (!source.includes("ENGINEERING_STANDARD.md")) {
    throw new Error(`${file} must reference the shared engineering standard.`);
  }
}

const expectedDefaultAgents = [
  "arquiteto",
  "domain-modeling",
  "executor",
  "qa",
  "observabilidade",
  "documentador",
];
if (JSON.stringify(codexProject.default_agents) !== JSON.stringify(expectedDefaultAgents)) {
  throw new Error(".codex/project.json must keep only the lean default agent set.");
}

for (const token of ["forward-only", "15 dias", "Git é o histórico", "lint, tipos, testes e build"]) {
  if (!standard.includes(token)) {
    throw new Error(`ENGINEERING_STANDARD.md is missing required rule: ${token}`);
  }
}

const legacyCopilotAgents = path.join(root, ".github", "agents");
if (fs.existsSync(legacyCopilotAgents) && fs.readdirSync(legacyCopilotAgents).some((name) => name.endsWith(".md"))) {
  throw new Error("Legacy Copilot agent definitions must not duplicate the shared standard.");
}

console.log("Shared agent instruction contract checks passed.");
