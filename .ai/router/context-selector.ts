import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ContextOptions, RouteResult } from "./types";

const defaultMaxFiles = 12;
const excludedDirectories = new Set([".git", ".next", ".npm-cache", ".vercel", "node_modules", ".temp"]);
const excludedExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".xlsx"]);

export function buildContextPackage(options: ContextOptions): Pick<RouteResult, "relevant_files" | "excluded_files" | "stable_context" | "open_questions"> {
  const rootDir = options.rootDir ?? process.cwd();
  const maxFiles = options.maxFiles ?? defaultMaxFiles;
  const request = options.request;
  const allFiles = listProjectFiles(rootDir);
  const directRefs = extractDirectFileReferences(request).filter((file) => {
    const absolute = path.join(rootDir, file);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  const candidates = new Map<string, number>();

  for (const file of directRefs) addScore(candidates, file, 100);
  for (const file of allFiles) addScore(candidates, file, scoreFile(file, request));
  for (const file of directRefs) {
    for (const dependency of resolveImportedDependencies(rootDir, file)) addScore(candidates, dependency, 30);
  }

  const relevant = Array.from(candidates.entries())
    .filter(([, score]) => score > 0)
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, maxFiles)
    .map(([file]) => file);

  return {
    relevant_files: relevant,
    excluded_files: buildExcludedFilesSummary(allFiles, relevant),
    stable_context: readStableContext(rootDir),
    open_questions: buildOpenQuestions(request, relevant),
  };
}

export function formatRouteResultAsYaml(result: RouteResult) {
  return [
    `classification: ${result.classification}`,
    `reason: ${quote(result.reason)}`,
    `risk_level: ${result.risk_level}`,
    `recommended_execution: ${quote(result.recommended_execution)}`,
    formatList("required_reviewers", result.required_reviewers),
    formatList("relevant_files", result.relevant_files),
    formatList("excluded_files", result.excluded_files),
    formatList("stable_context", result.stable_context),
    formatList("open_questions", result.open_questions),
  ].join("\n");
}

function listProjectFiles(rootDir: string) {
  const files: string[] = [];
  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (excludedDirectories.has(entry.name)) continue;
      const absolute = path.join(currentDir, entry.name);
      const relative = toProjectPath(path.relative(rootDir, absolute));
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (excludedExtensions.has(path.extname(entry.name).toLowerCase())) continue;
      if (statSync(absolute).size > 250_000) continue;
      files.push(relative);
    }
  }
  walk(rootDir);
  return files;
}

function scoreFile(file: string, request: string) {
  const normalized = normalize(request);
  const normalizedFile = normalize(file);
  let score = 0;
  const rules: Array<[string[], string[], number]> = [
    [["auth", "authentication", "login", "permission", "rls", "rbac", "security"], ["src/lib/auth", "src/server/auth", "src/lib/access", "docs/SECURITY.md"], 35],
    [["repository", "provider", "persistence"], ["src/lib/repositories", "docs/persistence-contract.md"], 30],
    [["report", "relatorio", "export", "planilha"], ["src/components/reports", "src/components/shared/report-export-actions.tsx", "src/lib/report-export.ts", "scripts/verify-report-exports.cjs"], 35],
    [["dashboard", "performance"], ["src/components", "scripts/verify-performance-hardening.cjs"], 18],
    [["studio", "hunter", "target", "meta", "renovacao", "renewal"], ["src/components/targets", "src/lib/studio-renewal-rollup.ts", "src/data/mockData.ts", "specs/delivery-coverage-hub"], 25],
    [["migration", "database", "supabase", "schema", "rpc"], ["supabase/migrations", "src/lib/repositories/supabaseDeliveryRepository.ts"], 40],
    [["local ai", "ai router", "router", "context", "local model", "ollama"], [".ai", ".vscode/tasks.json", "package.json"], 50],
    [["spec", "acceptance", "requirement"], ["specs/delivery-coverage-hub", "docs"], 15],
  ];
  for (const [keywords, paths, value] of rules) {
    if (keywords.some((keyword) => normalized.includes(normalize(keyword))) && paths.some((targetPath) => normalizedFile.includes(normalize(targetPath)))) {
      score += value;
    }
  }
  if (file.endsWith("AGENTS.md") || file === ".squad/config.yaml") score += 8;
  return score;
}

function extractDirectFileReferences(request: string) {
  const refs = request.match(/(?:\.?[\w-]+[\\/])+\S+|\b[\w-]+\.(?:ts|tsx|js|cjs|mjs|sql|md|json|yaml|yml)\b/g) ?? [];
  return refs.map((item) => toProjectPath(item.replace(/[.,;:)]+$/, "").replace(/^\.\//, "")));
}

function resolveImportedDependencies(rootDir: string, file: string) {
  const absolute = path.join(rootDir, file);
  if (!existsSync(absolute) || ![".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(path.extname(file))) return [];
  const source = readFileSync(absolute, "utf8").slice(0, 20_000);
  const imports = Array.from(source.matchAll(/from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g))
    .map((match) => match[1] ?? match[2])
    .filter((item) => item.startsWith(".") || item.startsWith("@/"));
  return imports.flatMap((specifier) => resolveSpecifier(rootDir, file, specifier)).slice(0, 4);
}

function resolveSpecifier(rootDir: string, fromFile: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? path.join(rootDir, "src", specifier.slice(2))
    : path.join(rootDir, path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates
    .filter((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    .map((candidate) => toProjectPath(path.relative(rootDir, candidate)));
}

function buildExcludedFilesSummary(allFiles: string[], relevant: string[]) {
  const excluded = [
    "node_modules/**",
    ".next/**",
    ".git/**",
    ".npm-cache/**",
    ".vercel/**",
    "supabase/.temp/**",
    "binary/large artifacts",
  ];
  const omittedCount = Math.max(0, allFiles.length - relevant.length);
  if (omittedCount > 0) excluded.push(`${omittedCount} non-selected project files`);
  return excluded;
}

function readStableContext(rootDir: string) {
  const files = [".ai/memory/project-summary.md", ".ai/memory/stable-facts.md", "docs/project-memory.md"];
  return files
    .map((file) => {
      const absolute = path.join(rootDir, file);
      if (!existsSync(absolute)) return undefined;
      const heading = readFileSync(absolute, "utf8").split(/\r?\n/).find((line) => line.startsWith("# ")) ?? file;
      return `${file}: ${heading.replace(/^#\s+/, "")}`;
    })
    .filter((item): item is string => Boolean(item));
}

function buildOpenQuestions(request: string, relevant: string[]) {
  const questions: string[] = [];
  if (!relevant.length) questions.push("No relevant files were selected; Codex should inspect the request before acting.");
  if (normalize(request).includes("migrate") || normalize(request).includes("migration")) {
    questions.push("Is this an analysis-only migration plan or an actual schema change?");
  }
  return questions;
}

function addScore(candidates: Map<string, number>, file: string, score: number) {
  if (score <= 0) return;
  candidates.set(file, (candidates.get(file) ?? 0) + score);
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\\/g, "/");
}

function toProjectPath(value: string) {
  return value.replace(/\\/g, "/");
}

function quote(value: string) {
  return JSON.stringify(value);
}

function formatList(label: string, values: string[]) {
  if (!values.length) return `${label}: []`;
  return [`${label}:`, ...values.map((value) => `  - ${quote(value)}`)].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const maxArgIndex = args.indexOf("--max-files");
  const maxFiles = maxArgIndex >= 0 ? Number(args[maxArgIndex + 1]) : Number(process.env.AI_MAX_FILES ?? defaultMaxFiles);
  const requestArgs = maxArgIndex >= 0
    ? args.filter((_, index) => index !== maxArgIndex && index !== maxArgIndex + 1)
    : args;
  const request = requestArgs.join(" ").trim() || process.env.AI_REQUEST || "";
  if (!request) throw new Error("Provide a request as CLI args or AI_REQUEST.");
  const result = buildContextPackage({ request, maxFiles: Number.isFinite(maxFiles) ? maxFiles : defaultMaxFiles, rootDir: process.cwd() });
  console.log(formatRouteResultAsYaml({
    classification: "UNKNOWN",
    reason: "Context package only. Run ai:route for classification.",
    risk_level: "medium",
    recommended_execution: "Use this focused context package before escalating to Codex.",
    required_reviewers: ["final code review"],
    ...result,
  }));
}

if (process.argv[1] && path.basename(process.argv[1]) === "context-selector.ts") {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
