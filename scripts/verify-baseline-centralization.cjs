/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const baselinesPage = fs.readFileSync(path.join(root, "src", "app", "baselines", "page.tsx"), "utf8");
const baselineCenter = fs.readFileSync(path.join(root, "src", "components", "baselines", "baseline-import-center.tsx"), "utf8");
const insightsPage = fs.readFileSync(path.join(root, "src", "app", "insights", "page.tsx"), "utf8");
const comparison = fs.readFileSync(path.join(root, "src", "components", "insights", "baseline-comparison.tsx"), "utf8");
const parser = fs.readFileSync(path.join(root, "src", "lib", "studio-baseline-import.ts"), "utf8");
const appShell = fs.readFileSync(path.join(root, "src", "components", "layout", "app-shell.tsx"), "utf8");

const requiredCenterTokens = [
  "BaselineImportCenter",
  "TargetBaselineImport",
  "BaselineImportMode",
  "ModeButton",
  "ReportExportActions",
  "studioBaselineSources",
  "readStudioBaselineWorkbook(file, source)",
  "sourceCode: source.code",
  "sourceName: source.name",
  "Salvar foto da baseline",
  'first="Baseline"',
  'second="Alocado"',
  "Última foto salva carregada",
  "restoreSnapshotRows",
  "TwoLineMoneyCell",
  "TwoLineTextCell",
  "Dif. Hunter",
  "Cadastro do cliente",
  "getDivergenceLabel",
  "getDeltaTextClassName",
];

const missingCenterTokens = requiredCenterTokens.filter((token) => !baselineCenter.includes(token));
if (missingCenterTokens.length) {
  throw new Error(`Baseline center is missing expected behavior: ${missingCenterTokens.join(", ")}`);
}

if (!baselinesPage.includes("BaselineImportCenter") || !appShell.includes('href: "/baselines"')) {
  throw new Error("Baselines route is not wired in the app navigation.");
}

if (insightsPage.includes("TargetBaselineImport")) {
  throw new Error("Insights must not keep the old baseline import component.");
}

const forbiddenComparisonTokens = [
  "readSheet",
  "parseTargetBaselineRows",
  "readStudioBaselineWorkbook",
  "saveStudioBaselineSnapshot",
  "Importar planilha",
  "Importar baseline de studios",
];

const leakedComparisonTokens = forbiddenComparisonTokens.filter((token) => comparison.includes(token));
if (leakedComparisonTokens.length) {
  throw new Error(`Baseline comparison still owns import/save behavior: ${leakedComparisonTokens.join(", ")}`);
}

const requiredParserTokens = [
  "supportedLayouts",
  "\"wide-customer-values\"",
  "\"detailed-studio\"",
  "tryParseWideStudioBaselineRows",
  "isWideGroupRow",
  "Renovação/Manut",
  "Novos Projetos/Hunter",
];

const missingParserTokens = requiredParserTokens.filter((token) => !parser.includes(token));
if (missingParserTokens.length) {
  throw new Error(`Studio baseline parser is missing layout centralization tokens: ${missingParserTokens.join(", ")}`);
}

console.log("Baseline centralization QA checks passed.");
