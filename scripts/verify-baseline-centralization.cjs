/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const baselinesPage = fs.readFileSync(path.join(root, "src", "app", "baselines", "page.tsx"), "utf8");
const baselineCenter = fs.readFileSync(path.join(root, "src", "components", "baselines", "baseline-import-center.tsx"), "utf8");
const insightsPage = fs.readFileSync(path.join(root, "src", "app", "insights", "page.tsx"), "utf8");
const comparison = fs.readFileSync(path.join(root, "src", "components", "insights", "baseline-comparison.tsx"), "utf8");
const targetImporter = fs.readFileSync(path.join(root, "src", "components", "insights", "target-baseline-import.tsx"), "utf8");
const parser = fs.readFileSync(path.join(root, "src", "lib", "studio-baseline-import.ts"), "utf8");
const studioReport = fs.readFileSync(path.join(root, "src", "lib", "studio-baseline-report.ts"), "utf8");
const studioCurveSnapshot = fs.readFileSync(path.join(root, "src", "lib", "studio-curve-baseline-snapshot.ts"), "utf8");
const xlsxReader = fs.readFileSync(path.join(root, "src", "lib", "xlsx-reader.ts"), "utf8");
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
  'first="Baseline Studio"',
  'second="Cadastrado"',
  'third="Baseline Curva"',
  "Última foto salva carregada",
  "restoreStudioBaselineComparisonRows",
  "buildStudioBaselineReportRows",
  "ThreeLineMoneyCell",
  "ThreeLineTextCell",
  "Dif. Hunter",
  "Cadastro do cliente",
  "Studio na curva",
  "Cadastrado no sistema",
  "customerStudioTarget",
  "getDivergenceLabel",
  "getDeltaTextClassName",
  "isFinancialBusinessUnit",
  "BU considerada",
  "manualStudioBaselineSources",
  "item.code !== \"studio_general\"",
  "financialKeys",
  "Marcar todos Financial",
  "Limpar Financial",
  "Marque ao menos uma linha como Financial",
  "marcada(s) como Financial",
  "sortStudioBaselineRows",
  "compareBusinessLabel",
  "Marque Financial somente nas linhas que devem entrar no snapshot",
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

const requiredStudioReportTokens = [
  "StudioBaselineReportRow",
  "buildStudioBaselineReportRows",
  "restoreStudioBaselineComparisonRows",
  "Baseline Studio",
  "Cadastrado",
  "Baseline Curva",
  "customerStudioTarget",
];

const missingStudioReportTokens = requiredStudioReportTokens.filter((token) => !studioReport.includes(token));
if (missingStudioReportTokens.length) {
  throw new Error(`Studio baseline report helpers are missing shared snapshot/report behavior: ${missingStudioReportTokens.join(", ")}`);
}

const requiredCurveSnapshotTokens = [
  "buildStudioCurveBaselineSnapshotInput",
  "parseCurveStudioBaselineRows",
  "getStudioBaselineSource(\"studio_general\")",
  "curveSheetColumns",
  "salesUnit: 0",
  "customerName: 2",
  "revenueStream: 9",
  "studioName: 11",
  "opportunityType: 14",
  "totalAmount: 33",
  "businessUnit: 69",
  "bu financial",
  "isStudioHunterOpportunity",
  "getEligibleCurveStudioName",
  "getCloudAllianceStudioName",
  "Alianças Google",
  "Alianças Microsoft",
  "Alianças AWS",
  "google llc",
  "microsoft",
  "amazon web",
  "isManagedServicesCustomer",
  "isManagedServicesRevenueStream",
  "Managed Services",
  "managed services / finops",
  "resell",
  "arquitetura",
  "weme",
  "squad",
  "times",
  "Baseline Curva",
  "studioTargetAllocations",
  "saveStudioBaselineSnapshot",
  "Sheet1",
  "Resumo RL 2026",
];

const missingCurveSnapshotTokens = requiredCurveSnapshotTokens.filter((token) =>
  !studioCurveSnapshot.includes(token) && !targetImporter.includes(token)
);
if (missingCurveSnapshotTokens.length) {
  throw new Error(`Curve import no longer creates the general Studio baseline snapshot: ${missingCurveSnapshotTokens.join(", ")}`);
}

const requiredCurveImportProgressTokens = [
  "ImportProgressPanel",
  "updateImportProgress",
  "readXlsxSheetRows",
  "importElapsedSeconds",
  "Lendo baseline de clientes",
  "Lendo abertura de Studios",
  "Comparando com cadastro",
  "Gerando baseline de Studios",
  "Salvando foto de Studios",
];

const missingCurveImportProgressTokens = requiredCurveImportProgressTokens.filter((token) => !targetImporter.includes(token));
if (missingCurveImportProgressTokens.length) {
  throw new Error(`Curve baseline import must show progress steps: ${missingCurveImportProgressTokens.join(", ")}`);
}

if (targetImporter.includes("read-excel-file/browser")) {
  throw new Error("Curve baseline import must use the lightweight XLSX reader instead of read-excel-file/browser.");
}

const forbiddenCurveImportTokens = [
  "return readXlsxSheetRows(buffer);",
  "if (!workbook || !relationships) return \"xl/worksheets/sheet1.xml\"",
  "if (!relationshipId) return \"xl/worksheets/sheet1.xml\"",
];

const leakedCurveImportTokens = forbiddenCurveImportTokens.filter((token) => targetImporter.includes(token) || xlsxReader.includes(token));
if (leakedCurveImportTokens.length) {
  throw new Error(`Curve import must not silently fall back to the first worksheet: ${leakedCurveImportTokens.join(", ")}`);
}

const requiredXlsxReaderTokens = [
  "getRequiredWorksheetPath",
  "Aba obrigatória não encontrada",
  "getRelationshipId",
  "normalizeWorksheetTarget",
];

const missingXlsxReaderTokens = requiredXlsxReaderTokens.filter((token) => !xlsxReader.includes(token));
if (missingXlsxReaderTokens.length) {
  throw new Error(`Lightweight XLSX reader must resolve named sheets explicitly: ${missingXlsxReaderTokens.join(", ")}`);
}

const requiredCurveGrainTokens = [
  "registeredCustomerStudioTarget: roundCurrency(row.baselineTotal)",
  "applyCurveBaselineToRows",
  "latestCurveSnapshotRows",
  "getCustomerStudioKey",
];

const missingCurveGrainTokens = requiredCurveGrainTokens.filter((token) => !studioCurveSnapshot.includes(token) && !baselineCenter.includes(token));
if (missingCurveGrainTokens.length) {
  throw new Error(`Studio Curve baseline must stay at customer + studio grain: ${missingCurveGrainTokens.join(", ")}`);
}

console.log("Baseline centralization QA checks passed.");
