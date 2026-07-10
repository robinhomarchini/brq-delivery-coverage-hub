import { readFileSync } from "node:fs";
import path from "node:path";
import { checkLocalModel, classifyWithLocalModel } from "./local-model-client";
import { buildContextPackage, formatRouteResultAsYaml } from "./context-selector";
import type { Reviewer, RiskLevel, RouteResult, RoutingLevel, RoutingRuleSet } from "./types";

const defaultRules: RoutingRuleSet = {
  critical: [
    "migration", "schema", "database", "supabase", "rls", "rpc", "auth", "authentication", "authorization",
    "role", "permission", "target", "baseline", "revenue", "transaction", "production", "security",
    "financial source of truth", "customer_target_years", "board_target_baselines", "hunter targets",
    "renewal", "expansion", "areas", "studios",
  ],
  standard: ["component", "navigation", "dashboard", "report", "export", "repository", "hook", "refactor", "performance", "ux"],
  local: ["summarize", "locate", "list files", "explain log", "classify", "generate checklist", "condense", "stable facts", "duplicated code"],
  criticalPaths: ["supabase/migrations", "src/lib/repositories", "src/lib/auth", "src/server/auth", "src/lib/access-control", "src/lib/access-context"],
  excludedPaths: [".git", ".next", ".npm-cache", ".vercel", "node_modules", "supabase/.temp", "package-lock.json", "tsconfig.tsbuildinfo"],
};

export function loadRoutingRules(rootDir = process.cwd()): RoutingRuleSet {
  const filePath = path.join(rootDir, ".ai", "router", "routing-rules.yaml");
  try {
    const source = readFileSync(filePath, "utf8");
    return {
      critical: readYamlList(source, "critical", "keywords", defaultRules.critical),
      standard: readYamlList(source, "standard", "keywords", defaultRules.standard),
      local: readYamlList(source, "local", "keywords", defaultRules.local),
      criticalPaths: readYamlList(source, "project", "critical_paths", defaultRules.criticalPaths),
      excludedPaths: readYamlList(source, "project", "excluded_paths", defaultRules.excludedPaths),
    };
  } catch {
    return defaultRules;
  }
}

export async function routeTask(request: string, rootDir = process.cwd(), maxFiles = 12): Promise<RouteResult> {
  const rules = loadRoutingRules(rootDir);
  const deterministic = classifyDeterministically(request, rules);
  let classification = deterministic.classification;
  const reasons = [...deterministic.reasons];

  if (classification === "UNKNOWN") {
    const local = await classifyWithLocalModel(request);
    if (local.available && local.classification && local.classification !== "UNKNOWN") {
      classification = local.classification === "LOCAL_ONLY" && !hasAnyKeyword(request, rules.local)
        ? "CODEX_STANDARD"
        : local.classification;
      reasons.push(`Local model suggested ${local.classification}: ${local.reason ?? "no reason provided"}`);
    } else {
      classification = "CODEX_STANDARD";
      reasons.push(`Unknown task escalated to CODEX_STANDARD. ${local.reason ?? "Local model not used."}`);
    }
  }

  if (classification === "LOCAL_ONLY" && deterministic.criticalMatched) {
    classification = "CODEX_CRITICAL";
    reasons.push("Critical rule override prevented LOCAL_ONLY classification.");
  }

  const context = buildContextPackage({ request, rootDir, maxFiles });
  return {
    classification,
    reason: reasons.join(" "),
    risk_level: getRiskLevel(classification, request),
    recommended_execution: getExecutionRecommendation(classification),
    required_reviewers: getRequiredReviewers(classification, request),
    relevant_files: context.relevant_files,
    excluded_files: context.excluded_files,
    stable_context: context.stable_context,
    open_questions: context.open_questions,
  };
}

export function classifyDeterministically(request: string, rules: RoutingRuleSet): { classification: RoutingLevel; reasons: string[]; criticalMatched: boolean } {
  const normalized = normalize(request);
  const affectedPaths = extractPathLikeTokens(request);
  const pathCritical = affectedPaths.some((item) => rules.criticalPaths.some((rule) => normalizePath(item).startsWith(normalizePath(rule))));
  const keywordCritical = rules.critical.some((keyword) => normalized.includes(normalize(keyword)));
  const financialReportCritical = hasAnyKeyword(request, ["report", "dashboard", "export", "relatorio", "planilha"])
    && hasAnyKeyword(request, ["financial", "financeiro", "target", "meta", "revenue", "renovacao", "hunter", "studio"]);

  if (pathCritical || keywordCritical || financialReportCritical) {
    return {
      classification: "CODEX_CRITICAL",
      reasons: [
        pathCritical ? "Affected path matches project critical paths." : "",
        keywordCritical ? "Critical keyword matched." : "",
        financialReportCritical ? "Financial report/dashboard/export rule matched." : "",
      ].filter(Boolean),
      criticalMatched: true,
    };
  }

  if (hasAnyKeyword(request, rules.standard)) {
    return { classification: "CODEX_STANDARD", reasons: ["Standard implementation keyword matched."], criticalMatched: false };
  }

  if (hasAnyKeyword(request, rules.local)) {
    return { classification: "LOCAL_ONLY", reasons: ["Local-only utility keyword matched."], criticalMatched: false };
  }

  return { classification: "UNKNOWN", reasons: ["No deterministic rule matched."], criticalMatched: false };
}

function getRiskLevel(classification: RoutingLevel, request: string): RiskLevel {
  if (classification === "CODEX_CRITICAL") return "critical";
  if (classification === "CODEX_STANDARD") return hasAnyKeyword(request, ["repository", "report", "export", "dashboard"]) ? "high" : "medium";
  if (classification === "LOCAL_ONLY") return "low";
  return "medium";
}

function getExecutionRecommendation(classification: RoutingLevel) {
  if (classification === "LOCAL_ONLY") return "Run local classification/summarization only. Do not edit production code.";
  if (classification === "CODEX_CRITICAL") return "Escalate to Codex with domain, database/security and final code review gates.";
  if (classification === "CODEX_STANDARD") return "Escalate to Codex standard implementation flow with focused context.";
  return "Escalate to Codex; do not run as LOCAL_ONLY.";
}

function getRequiredReviewers(classification: RoutingLevel, request: string): Reviewer[] {
  const reviewers = new Set<Reviewer>();
  if (classification === "LOCAL_ONLY") {
    reviewers.add("final code review");
    return Array.from(reviewers);
  }

  reviewers.add("domain");
  if (classification === "CODEX_CRITICAL" || hasAnyKeyword(request, ["database", "supabase", "repository", "migration", "target", "baseline"])) reviewers.add("database");
  if (classification === "CODEX_CRITICAL" || hasAnyKeyword(request, ["auth", "security", "permission", "rls", "rbac"])) reviewers.add("security");
  if (hasAnyKeyword(request, ["ui", "ux", "component", "dashboard", "report", "screen", "tela"])) reviewers.add("UX");
  if (hasAnyKeyword(request, ["refactor", "duplicate", "componentization", "reuse", "duplicado"])) reviewers.add("reuse/componentization");
  if (hasAnyKeyword(request, ["performance", "slow", "query", "dashboard", "report"])) reviewers.add("performance");
  reviewers.add("final code review");
  return Array.from(reviewers);
}

function readYamlList(source: string, section: string, key: string, fallback: string[]) {
  const lines = source.split(/\r?\n/);
  const sectionLine = lines.findIndex((line) => line.trim() === `${section}:`);
  if (sectionLine < 0) return fallback;
  const keyLine = lines.findIndex((line, index) => index > sectionLine && line.trim() === `${key}:`);
  if (keyLine < 0) return fallback;
  const values: string[] = [];
  for (let index = keyLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) || /^\s{2}\S[^:\n]*:\s*$/.test(line)) break;
    const match = line.match(/^\s*-\s+(.+)$/);
    if (match) values.push(match[1].trim());
  }
  return values.length ? values : fallback;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizePath(value: string) {
  return normalize(value).replace(/\\/g, "/").replace(/^\.\//, "");
}

function hasAnyKeyword(request: string, keywords: string[]) {
  const normalized = normalize(request);
  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function extractPathLikeTokens(request: string) {
  return request.match(/(?:\.?[\w-]+[\\/])+\S+|\b[\w-]+\.(?:ts|tsx|js|cjs|mjs|sql|md|json|yaml|yml)\b/g) ?? [];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check-local-model")) {
    console.log(formatRouteResultAsYaml({
      classification: "LOCAL_ONLY",
      reason: (await checkLocalModel()).reason,
      risk_level: "low",
      recommended_execution: "Local model health check only.",
      required_reviewers: ["final code review"],
      relevant_files: [".ai/router/local-model-client.ts"],
      excluded_files: [],
      stable_context: [],
      open_questions: [],
    }));
    return;
  }

  const maxArgIndex = args.indexOf("--max-files");
  const maxFiles = maxArgIndex >= 0 ? Number(args[maxArgIndex + 1]) : Number(process.env.AI_MAX_FILES ?? 12);
  const requestArgs = maxArgIndex >= 0
    ? args.filter((_, index) => index !== maxArgIndex && index !== maxArgIndex + 1)
    : args;
  const request = requestArgs.join(" ").trim() || process.env.AI_REQUEST || "";
  if (!request) {
    throw new Error("Provide a request as CLI args or AI_REQUEST.");
  }
  console.log(formatRouteResultAsYaml(await routeTask(request, process.cwd(), Number.isFinite(maxFiles) ? maxFiles : 12)));
}

if (process.argv[1] && path.basename(process.argv[1]) === "task-router.ts") {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
