import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const projectFile = path.join(root, ".vercel", "project.json");
const authFile = path.join(os.homedir(), ".vercel", "auth.json");
const hasToken = Boolean(process.env.VERCEL_TOKEN?.trim());
const hasAuthFile = fs.existsSync(authFile);

if (!fs.existsSync(projectFile)) {
  console.error("Vercel project is not linked. Missing .vercel/project.json.");
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
if (!project.projectId || !project.orgId) {
  console.error("Vercel project link is incomplete. Check .vercel/project.json.");
  process.exit(1);
}

if (!hasToken && !hasAuthFile) {
  console.error([
    "Vercel CLI is not authenticated for this Windows user.",
    "Expected one of:",
    "- VERCEL_TOKEN set in the environment; or",
    "- local login at %USERPROFILE%\\.vercel\\auth.json.",
    "",
    "Run `npx --cache .npm-cache --yes vercel login` once, then retry deploy.",
  ].join("\n"));
  process.exit(1);
}

console.log(`Vercel deploy auth looks ready for project ${project.projectName ?? project.projectId}.`);
