/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const packageSource = fs.readFileSync(path.join(root, "package.json"), "utf8");
const prodDeploySource = fs.readFileSync(path.join(root, "scripts", "vercel-prod-deploy.mjs"), "utf8");
const vercelCliSource = fs.readFileSync(path.join(root, "scripts", "vercel-cli.mjs"), "utf8");
const inspectSource = fs.readFileSync(path.join(root, "scripts", "vercel-inspect.mjs"), "utf8");
const githubChecksSource = fs.readFileSync(path.join(root, "scripts", "github-checks.mjs"), "utf8");
const checkAuthSource = fs.readFileSync(path.join(root, "scripts", "check-vercel-deploy-auth.mjs"), "utf8");

assertIncludes(packageSource, "\"deploy:check\": \"node scripts/check-vercel-deploy-auth.mjs && npm run test:deploy-tooling\"", "package.json must expose deploy:check with deploy tooling validation.");
assertIncludes(packageSource, "\"deploy:prod\": \"npm run deploy:check && node scripts/vercel-prod-deploy.mjs\"", "package.json must expose the approved production deploy script.");
assertIncludes(packageSource, "\"deploy:inspect\": \"node scripts/vercel-inspect.mjs\"", "package.json must expose deploy:inspect.");
assertIncludes(packageSource, "\"deploy:inspect:prod\": \"node scripts/vercel-inspect.mjs brq-delivery-coverage-hub.vercel.app\"", "package.json must expose deploy:inspect:prod.");
assertIncludes(packageSource, "\"github:checks\": \"node scripts/github-checks.mjs\"", "package.json must expose github:checks.");

assertIncludes(vercelCliSource, "loadLocalEnv()", "Vercel wrapper must load local env files.");
assertIncludes(vercelCliSource, "\"node@22\"", "Vercel wrapper must run through Node 22.");
assertIncludes(vercelCliSource, "\"vercel@56.2.0\"", "Vercel wrapper must pin the Vercel CLI version.");
assertIncludes(vercelCliSource, "LOCALAPPDATA", "Vercel wrapper must isolate Windows LOCALAPPDATA.");
assertIncludes(vercelCliSource, "NPM_CONFIG_CACHE", "Vercel wrapper must isolate npm cache.");
assertIncludes(vercelCliSource, "Do not run npx vercel directly", "Vercel wrapper must explain the approved path.");
assertIncludes(vercelCliSource, "npx-cli.js", "Vercel wrapper must prefer the npm npx JS entrypoint instead of shelling out.");
assertNotIncludes(vercelCliSource, "shell: process.platform", "Vercel wrapper must avoid shell:true warnings.");
assertIncludes(prodDeploySource, "scripts/vercel-cli.mjs", "Production deploy must use the Vercel wrapper.");
assertNotIncludes(prodDeploySource, "\"npx\"", "Production deploy must not spawn npx directly.");
assertNotIncludes(prodDeploySource, "shell: process.platform", "Production deploy must avoid shell:true warnings.");
assertIncludes(inspectSource, "VERCEL_CLI_STDIO", "Deploy inspect must capture Vercel output for readiness polling.");
assertNotIncludes(inspectSource, "shell: process.platform", "Deploy inspect must avoid shell:true warnings.");
assertIncludes(githubChecksSource, "Avoid retrying raw gh run list variants", "GitHub checks wrapper must prevent repeated raw CLI retries.");
assertIncludes(githubChecksSource, "gh.exe", "GitHub checks wrapper must call gh.exe directly on Windows instead of shelling out.");
assertIncludes(checkAuthSource, "deploy:prod will run Vercel CLI through node@22", "Deploy preflight must document the Node 22 fallback.");

console.log("Deploy tooling checks passed.");

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message);
  }
}

function assertNotIncludes(source, token, message) {
  if (source.includes(token)) {
    throw new Error(message);
  }
}
