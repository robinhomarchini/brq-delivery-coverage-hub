/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { unzipSync, strFromU8 } = require("fflate");

const reportPath = path.join(process.cwd(), "src", "components", "reports", "person-target-report.tsx");
const officialExportPath = path.join(process.cwd(), "src", "lib", "reports", "person-target-official-export.ts");
const reportExportActionsPath = path.join(process.cwd(), "src", "components", "shared", "report-export-actions.tsx");
const reportExportServicePath = path.join(process.cwd(), "src", "lib", "report-export.ts");
const source = fs.readFileSync(reportPath, "utf8");
const officialExportSource = fs.readFileSync(officialExportPath, "utf8");
const reportExportActionsSource = fs.readFileSync(reportExportActionsPath, "utf8");
const reportExportServiceSource = fs.readFileSync(reportExportServicePath, "utf8");
const root = process.cwd();
const originalResolveFilename = Module._resolveFilename;

require("sucrase/register");

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const requiredOfficialColumns = [
  "BU/Área Executivo",
  "Executivo",
  "Grupo Cliente",
  "Cliente Faturamento",
  "BU",
  "Meta 2026",
  "Renovação (FARMER)",
  "Novo (HUNTER)",
  "% Novo",
];

const missingColumns = requiredOfficialColumns.filter((label) => !source.includes(`label: "${label}"`));
if (missingColumns.length) {
  throw new Error(`Official report export is missing columns: ${missingColumns.join(", ")}`);
}

if (!source.includes("columns: officialReportColumns as ReportColumn<unknown>[]")) {
  throw new Error("Planilha oficial is not wired to officialReportColumns.");
}

if (!reportExportActionsSource.includes("function CustomExportButton") || !reportExportActionsSource.includes("key={`preview-${customExport.label}-${customExport.filename}`")) {
  throw new Error("Custom report exports must reuse one button component and be available inside the preview dialog.");
}

if (!reportExportActionsSource.includes("@/lib/report-export") || reportExportActionsSource.includes("function buildXlsxWorkbook")) {
  throw new Error("ReportExportActions must delegate CSV/XLSX generation to src/lib/report-export.");
}

if (!reportExportServiceSource.includes("export function buildXlsxWorkbook") || !reportExportServiceSource.includes("export function exportRowsAsCsv")) {
  throw new Error("Report export service must expose workbook and CSV generation.");
}

if (!source.includes("officialLayout: true")) {
  throw new Error("Planilha oficial is not using the official workbook layout.");
}

if (!source.includes("FINANCIAL-Hunters-Especializados") || !source.includes("FINANCIAL-Rateio-Metas-AEs")) {
  throw new Error("Specialist Hunter official export must use a distinct filename from the standard official spreadsheet.");
}

const requiredSpecialistHunterReportTokens = [
  'relationshipType: principalHunterKeys.has(`${person.id}:${allocation.customerId}`) ? "principal" : "selection"',
  'row.relationshipType === "principal" ? "Hunter principal" : row.relationshipType === "associated" ? "Cliente associado" : "Seleção gerencial"',
];
const missingSpecialistHunterReportTokens = requiredSpecialistHunterReportTokens.filter((token) => !source.includes(token));
if (missingSpecialistHunterReportTokens.length) {
  throw new Error(`Specialist Hunter report is missing relationship handling: ${missingSpecialistHunterReportTokens.join(", ")}`);
}

if (!officialExportSource.includes('export const officialSquadsTeamsBillingCustomer = "Squads/Times"')) {
  throw new Error("Planilha oficial must identify own Squads/Times rows in Cliente Faturamento.");
}

if (!officialExportSource.includes('export const officialDefaultBusinessUnit = "Financial"')) {
  throw new Error("Planilha oficial must default BU to Financial.");
}

if (!officialExportSource.includes("billingCustomer: studioName") || !officialExportSource.includes("billingCustomer: item.studioName")) {
  throw new Error("Planilha oficial must write the Studio name in Cliente Faturamento for Studio rows.");
}

const requiredOfficialPeopleFlowTokens = [
  "buildOfficialPeopleRowsFromSources",
  'personAliasIds.has(getEffectiveStudioHunterPersonId(allocation, people, allocations) ?? "")',
  "executive: personRow.personName",
  "hunter: allocation.hunterAmount",
  "buildOfficialStudioMaintenanceRows",
  "isStudioRenewalEligibleForFarmer",
  "customerIdsInScope",
  "executive: item.studioName",
  "farmerRenewal: item.maintenanceAmount",
  "executive: \"Studio Manutenção\"",
];
const missingOfficialPeopleFlowTokens = requiredOfficialPeopleFlowTokens.filter((token) => !officialExportSource.includes(token));
if (missingOfficialPeopleFlowTokens.length) {
  throw new Error(`Planilha oficial person-first Studio flow is missing tokens: ${missingOfficialPeopleFlowTokens.join(", ")}`);
}

const requiredOfficialExportViews = [
  "people",
  "areas",
  "hunters",
  "hunterClients",
  "directors",
];

const requiredClientCoverageTokens = [
  '{ key: "clients", label: "Clientes" }',
  "buildClientCoverageRows",
  "Clientes x Hunters x Delivery",
  "Delivery / Farmers",
  "Hunters Especializados",
  "Meta do cliente",
  "Diferença",
  "getClientCoverageReportColumns",
  "showClientCoverageValues",
  "includeNewLogos",
  "Incluir New Logos",
  "reportCustomers",
  "reportTargetAllocations",
  "reportStudioTargetAllocations",
];
const missingClientCoverageTokens = requiredClientCoverageTokens.filter((token) => !source.includes(token));
if (missingClientCoverageTokens.length) {
  throw new Error(`Client coverage report is missing tokens: ${missingClientCoverageTokens.join(", ")}`);
}

const forbiddenClientCoverageValueTokens = [
  "formatClientCoveragePerson",
  "showValues ? row.huntersText",
  "showValues ? row.deliveryManagersText",
  "showValues ? row.specialistHuntersText",
  "person.amount > 0.01 ? ` · ${formatCurrency(person.amount)}`",
];
const foundForbiddenClientCoverageValueTokens = forbiddenClientCoverageValueTokens.filter((token) => source.includes(token));
if (foundForbiddenClientCoverageValueTokens.length) {
  throw new Error(`Client coverage report must keep person labels value-free: ${foundForbiddenClientCoverageValueTokens.join(", ")}`);
}

const requiredValueFreeClientCoverageTokens = [
  "huntersText: formatClientCoveragePeopleNames(sortClientCoveragePeople(hunters))",
  "deliveryManagersText: formatClientCoveragePeopleNames(sortClientCoveragePeople(deliveryManagers))",
  "specialistHuntersText: formatClientCoveragePeopleNames(sortClientCoveragePeople(specialistHunters))",
  '{ key: "huntersText", label: "Hunters", value: (row) => row.huntersText }',
  '{ key: "deliveryManagersText", label: "Delivery / Farmers", value: (row) => row.deliveryManagersText }',
  '{ key: "specialistHuntersText", label: "Hunters Especializados", value: (row) => row.specialistHuntersText }',
];
const missingValueFreeClientCoverageTokens = requiredValueFreeClientCoverageTokens.filter((token) => !source.includes(token));
if (missingValueFreeClientCoverageTokens.length) {
  throw new Error(`Client coverage report must export person names without allocated values: ${missingValueFreeClientCoverageTokens.join(", ")}`);
}

for (const view of requiredOfficialExportViews) {
  const branchPattern = new RegExp(`\\{effectiveView === "${view}"[\\s\\S]*?<ReportExportActions([\\s\\S]*?)\\/>`);
  const branchMatch = source.match(branchPattern);
  if (!branchMatch) {
    throw new Error(`Report view '${view}' was not found.`);
  }
  const block = branchMatch[1];
  if (!block.includes("customExports={officialCustomExports}")) {
    throw new Error(`Report view '${view}' does not expose Planilha oficial.`);
  }
}

const { buildXlsxWorkbook } = require("../src/lib/report-export.ts");
const { buildOfficialRowsForView } = require("../src/components/reports/person-target-report.tsx");
const generatedEligibleStudioRenewalRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "farmer-qa",
    personName: "Farmer QA",
    email: "farmer.qa@brq.com",
    roleType: "Farmer + Delivery",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Cliente QA"],
    hunter: 0,
    farmerRenewal: 70,
    total: 70,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "farmer-qa",
    name: "Farmer QA",
    roleType: "Farmer + Delivery",
    active: true,
    clientIds: ["customer-qa"],
  }],
  allocations: [{
    id: "target-farmer-qa",
    customerId: "customer-qa",
    personId: "farmer-qa",
    type: "farmer_renewal",
    year: 2026,
    amount: 70,
    ownAmount: 50,
  }],
  studioAllocations: [{
    id: "studio-renewal-qa",
    customerId: "customer-qa",
    areaId: "studio-renewal",
    hunterPersonId: "farmer-qa",
    year: 2026,
    hunterAmount: 0,
    maintenanceAmount: 20,
  }],
  customerNames: new Map([["customer-qa", "Cliente QA"]]),
  areaNames: new Map([["studio-renewal", "Studio Renovação QA"]]),
  year: 2026,
});
if (!generatedEligibleStudioRenewalRows.some((row) => row.executive === "Farmer QA" && row.customerName === "Cliente QA" && row.billingCustomer === "Squads/Times" && row.farmerRenewal === 50)) {
  throw new Error("Generated official rows did not keep Farmer/Delivery own renewal as a separate row.");
}
if (!generatedEligibleStudioRenewalRows.some((row) => row.executive === "Farmer QA" && row.customerName === "Cliente QA" && row.billingCustomer === "Studio Renovação QA" && row.farmerRenewal === 20)) {
  throw new Error("Generated official rows did not keep eligible Studio renewal as a separate Studio billing row.");
}
if (!generatedEligibleStudioRenewalRows.some((row) => row.executive === "Farmer QA" && row.customerName === "Subtotal (na meta)" && row.farmerRenewal === 50)) {
  throw new Error("Generated official rows must subtotal Farmer/Delivery own renewal without adding inherited Studio renewal again.");
}
if (generatedEligibleStudioRenewalRows.some((row) => row.executive === "Studio Renovação QA")) {
  throw new Error("Generated official rows duplicated eligible Studio renewal in the final Studio maintenance block.");
}

const generatedReadTimeStudioRenewalRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "delivery-qa",
    personName: "Delivery QA",
    email: "delivery.qa@brq.com",
    roleType: "Delivery",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Cliente Read QA"],
    hunter: 0,
    farmerRenewal: 0,
    total: 0,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "delivery-qa",
    name: "Delivery QA",
    roleType: "Delivery",
    active: true,
    clientIds: ["customer-read-qa"],
  }],
  allocations: [],
  studioAllocations: [{
    id: "studio-read-renewal-qa",
    customerId: "customer-read-qa",
    areaId: "studio-salesforce",
    maintenancePersonId: "delivery-qa",
    year: 2026,
    hunterAmount: 0,
    maintenanceAmount: 35,
  }],
  customerNames: new Map([["customer-read-qa", "Cliente Read QA"]]),
  areaNames: new Map([["studio-salesforce", "Salesforce"]]),
  year: 2026,
});
if (!generatedReadTimeStudioRenewalRows.some((row) => row.executive === "Delivery QA" && row.customerName === "Cliente Read QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 35)) {
  throw new Error("Generated official rows did not derive existing Studio renewal into the Farmer/Delivery person without a persisted target.");
}
if (generatedReadTimeStudioRenewalRows.some((row) => row.executive === "Salesforce")) {
  throw new Error("Generated official rows duplicated assigned Studio renewal in the final Studio maintenance block.");
}

const generatedExplicitMaintenanceRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "explicit-maintenance-qa",
    personName: "Explicit Maintenance QA",
    email: "explicit.maintenance.qa@brq.com",
    roleType: "Hunter",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Cliente Explicit QA"],
    hunter: 0,
    farmerRenewal: 0,
    total: 0,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "explicit-maintenance-qa",
    name: "Explicit Maintenance QA",
    roleType: "Hunter",
    active: true,
    clientIds: ["customer-explicit-qa"],
  }],
  allocations: [],
  studioAllocations: [{
    id: "studio-explicit-maintenance-qa",
    customerId: "customer-explicit-qa",
    areaId: "studio-salesforce-explicit",
    maintenancePersonId: "explicit-maintenance-qa",
    year: 2026,
    hunterAmount: 0,
    maintenanceAmount: 25,
  }],
  customerNames: new Map([["customer-explicit-qa", "Cliente Explicit QA"]]),
  areaNames: new Map([["studio-salesforce-explicit", "Salesforce"]]),
  year: 2026,
});
if (!generatedExplicitMaintenanceRows.some((row) => row.executive === "Explicit Maintenance QA" && row.customerName === "Cliente Explicit QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 25)) {
  throw new Error("Generated official rows did not honor explicit Studio maintenance responsible person in the person target rollup.");
}
if (generatedExplicitMaintenanceRows.some((row) => row.executive === "Salesforce")) {
  throw new Error("Generated official rows duplicated explicitly assigned Studio maintenance in the final Studio maintenance block.");
}

const generatedCurrentMinusStudioRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "stale-own-qa",
    personName: "Stale Own QA",
    email: "stale.own.qa@brq.com",
    roleType: "Hunter",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Cliente Stale QA"],
    hunter: 300,
    farmerRenewal: 140,
    total: 440,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "stale-own-qa",
    name: "Stale Own QA",
    roleType: "Hunter",
    active: true,
    clientIds: ["customer-stale-qa"],
  }],
  allocations: [
    {
      id: "target-stale-hunter-qa",
      customerId: "customer-stale-qa",
      personId: "stale-own-qa",
      type: "hunter",
      year: 2026,
      amount: 300,
      ownAmount: 250,
    },
    {
      id: "target-stale-renewal-qa",
      customerId: "customer-stale-qa",
      personId: "stale-own-qa",
      type: "farmer_renewal",
      year: 2026,
      amount: 140,
      ownAmount: 90,
    },
  ],
  studioAllocations: [
    {
      id: "studio-stale-hunter-qa",
      customerId: "customer-stale-qa",
      areaId: "studio-stale-hunter",
      hunterPersonId: "stale-own-qa",
      year: 2026,
      hunterAmount: 100,
      maintenanceAmount: 0,
    },
    {
      id: "studio-stale-maintenance-qa",
      customerId: "customer-stale-qa",
      areaId: "studio-stale-maintenance",
      maintenancePersonId: "stale-own-qa",
      year: 2026,
      hunterAmount: 0,
      maintenanceAmount: 40,
    },
  ],
  customerNames: new Map([["customer-stale-qa", "Cliente Stale QA"]]),
  areaNames: new Map([
    ["studio-stale-hunter", "Studio Hunter Stale QA"],
    ["studio-stale-maintenance", "Studio Manutenção Stale QA"],
  ]),
  year: 2026,
});
if (!generatedCurrentMinusStudioRows.some((row) => row.executive === "Stale Own QA" && row.customerName === "Cliente Stale QA" && row.billingCustomer === "Squads/Times" && row.hunter === 200 && row.farmerRenewal === 100)) {
  throw new Error("Generated official rows must compute own target as current amount minus contained Studio, ignoring stale own_amount caches.");
}

const generatedMultipleStudioHunterRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "multi-studio-hunter-qa",
    personName: "Multi Studio Hunter QA",
    email: "multi.studio.hunter.qa@brq.com",
    roleType: "Hunter",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Banco QA"],
    hunter: 47998066,
    farmerRenewal: 0,
    total: 47998066,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "multi-studio-hunter-qa",
    name: "Multi Studio Hunter QA",
    roleType: "Hunter",
    active: true,
    clientIds: ["customer-multi-studio-qa"],
  }],
  allocations: [{
    id: "target-multi-studio-hunter-qa",
    customerId: "customer-multi-studio-qa",
    personId: "multi-studio-hunter-qa",
    type: "hunter",
    year: 2026,
    amount: 47998066,
    ownAmount: 47998066,
  }, {
    id: "target-multi-studio-hunter-duplicate-qa",
    customerId: "customer-multi-studio-qa",
    personId: "multi-studio-hunter-qa",
    type: "hunter",
    year: 2026,
    amount: 5204429,
    ownAmount: 0,
  }, {
    id: "target-multi-studio-hunter-inflated-duplicate-qa",
    customerId: "customer-multi-studio-qa",
    personId: "multi-studio-hunter-qa",
    type: "hunter",
    year: 2026,
    amount: 53202495,
    ownAmount: 47998066,
  }],
  studioAllocations: [
    {
      id: "studio-multi-analytics-qa",
      customerId: "customer-multi-studio-qa",
      areaId: "studio-multi-analytics",
      hunterPersonId: "multi-studio-hunter-qa",
      year: 2026,
      hunterAmount: 4804429,
      maintenanceAmount: 0,
    },
    {
      id: "studio-multi-salesforce-qa",
      customerId: "customer-multi-studio-qa",
      areaId: "studio-multi-salesforce",
      hunterPersonId: "multi-studio-hunter-qa",
      year: 2026,
      hunterAmount: 400000,
      maintenanceAmount: 0,
    },
  ],
  customerNames: new Map([["customer-multi-studio-qa", "Banco QA"]]),
  areaNames: new Map([
    ["studio-multi-analytics", "Analytics"],
    ["studio-multi-salesforce", "Salesforce"],
  ]),
  year: 2026,
});
if (!generatedMultipleStudioHunterRows.some((row) => row.executive === "Multi Studio Hunter QA" && row.customerName === "Banco QA" && row.billingCustomer === "Squads/Times" && row.hunter === 42793637)) {
  throw new Error("Generated official rows must subtract all inherited Studio Hunter lines from the person's own customer row.");
}
if (!generatedMultipleStudioHunterRows.some((row) => row.executive === "Multi Studio Hunter QA" && row.customerName === "Banco QA" && row.billingCustomer === "Analytics" && row.hunter === 4804429)) {
  throw new Error("Generated official rows must keep Analytics inherited Studio Hunter as a separate billing row.");
}
if (!generatedMultipleStudioHunterRows.some((row) => row.executive === "Multi Studio Hunter QA" && row.customerName === "Banco QA" && row.billingCustomer === "Salesforce" && row.hunter === 400000)) {
  throw new Error("Generated official rows must keep Salesforce inherited Studio Hunter as a separate billing row.");
}
if (!generatedMultipleStudioHunterRows.some((row) => row.executive === "Multi Studio Hunter QA" && row.customerName === "Subtotal (na meta)" && row.hunter === 42793637)) {
  throw new Error("Generated official rows must subtotal the person's own Hunter target without adding inherited Studio Hunter again.");
}

const generatedAliasRenewalStudioRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "ricardo-bonfim-main-qa",
    personName: "Ricardo Lucio do Bonfim QA",
    email: "ricardo.bonfim.qa@brq.com",
    roleType: "Delivery",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["BANCO ITAÚ QA"],
    hunter: 0,
    farmerRenewal: 47998066,
    total: 47998066,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "ricardo-bonfim-main-qa",
    name: "Ricardo Lucio do Bonfim QA",
    roleType: "Delivery",
    active: true,
    clientIds: ["customer-itau-alias-qa"],
  }, {
    id: "ricardo-bonfim-studio-alias-qa",
    name: "Ricardo Lucio do Bonfim QA",
    roleType: "Delivery",
    active: true,
    clientIds: ["customer-itau-alias-qa"],
  }],
  allocations: [{
    id: "target-ricardo-bonfim-main-qa",
    customerId: "customer-itau-alias-qa",
    personId: "ricardo-bonfim-main-qa",
    type: "farmer_renewal",
    year: 2026,
    amount: 47998066,
    ownAmount: 47998066,
  }],
  studioAllocations: [
    {
      id: "studio-ricardo-bonfim-analytics-alias-qa",
      customerId: "customer-itau-alias-qa",
      areaId: "studio-ricardo-bonfim-analytics-alias",
      maintenancePersonId: "ricardo-bonfim-studio-alias-qa",
      year: 2026,
      hunterAmount: 0,
      maintenanceAmount: 4804429,
    },
    {
      id: "studio-ricardo-bonfim-salesforce-alias-qa",
      customerId: "customer-itau-alias-qa",
      areaId: "studio-ricardo-bonfim-salesforce-alias",
      maintenancePersonId: "ricardo-bonfim-studio-alias-qa",
      year: 2026,
      hunterAmount: 0,
      maintenanceAmount: 400000,
    },
  ],
  customerNames: new Map([["customer-itau-alias-qa", "BANCO ITAÚ QA"]]),
  areaNames: new Map([
    ["studio-ricardo-bonfim-analytics-alias", "Analytics"],
    ["studio-ricardo-bonfim-salesforce-alias", "Salesforce"],
  ]),
  year: 2026,
});
if (!generatedAliasRenewalStudioRows.some((row) => row.executive === "Ricardo Lucio do Bonfim QA" && row.customerName === "BANCO ITAÚ QA" && row.billingCustomer === "Squads/Times" && row.farmerRenewal === 42793637)) {
  throw new Error("Generated official rows must subtract inherited Studio renewal even when legacy person IDs differ but name/profile match.");
}
if (!generatedAliasRenewalStudioRows.some((row) => row.executive === "Ricardo Lucio do Bonfim QA" && row.customerName === "BANCO ITAÚ QA" && row.billingCustomer === "Analytics" && row.farmerRenewal === 4804429)) {
  throw new Error("Generated official rows must keep alias Analytics Studio renewal as a separate billing row.");
}
if (!generatedAliasRenewalStudioRows.some((row) => row.executive === "Ricardo Lucio do Bonfim QA" && row.customerName === "BANCO ITAÚ QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 400000)) {
  throw new Error("Generated official rows must keep alias Salesforce Studio renewal as a separate billing row.");
}
if (!generatedAliasRenewalStudioRows.some((row) => row.executive === "Ricardo Lucio do Bonfim QA" && row.customerName === "Subtotal (na meta)" && row.farmerRenewal === 42793637)) {
  throw new Error("Generated official rows must subtotal alias renewal without inherited Studio renewal.");
}

const generatedOwnAndInheritedFarmerRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "farmer-split-qa",
    personName: "Farmer Split QA",
    email: "farmer.split.qa@brq.com",
    roleType: "Delivery",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Cliente Split QA"],
    hunter: 0,
    farmerRenewal: 125,
    total: 125,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "farmer-split-qa",
    name: "Farmer Split QA",
    roleType: "Delivery",
    active: true,
    clientIds: ["customer-split-qa"],
  }],
  allocations: [{
    id: "target-farmer-split-qa",
    customerId: "customer-split-qa",
    personId: "farmer-split-qa",
    type: "farmer_renewal",
    year: 2026,
    amount: 125,
    ownAmount: 100,
  }, {
    id: "target-farmer-split-inflated-duplicate-qa",
    customerId: "customer-split-qa",
    personId: "farmer-split-qa",
    type: "farmer_renewal",
    year: 2026,
    amount: 150,
    ownAmount: 125,
  }],
  studioAllocations: [{
    id: "studio-farmer-split-qa",
    customerId: "customer-split-qa",
    areaId: "studio-salesforce-split",
    maintenancePersonId: "farmer-split-qa",
    year: 2026,
    hunterAmount: 0,
    maintenanceAmount: 25,
  }],
  customerNames: new Map([["customer-split-qa", "Cliente Split QA"]]),
  areaNames: new Map([["studio-salesforce-split", "Salesforce"]]),
  year: 2026,
});
if (!generatedOwnAndInheritedFarmerRows.some((row) => row.executive === "Farmer Split QA" && row.customerName === "Cliente Split QA" && row.billingCustomer === "Squads/Times" && row.farmerRenewal === 100)) {
  throw new Error("Generated official rows did not keep Farmer/Delivery own renewal as a separate row.");
}
if (!generatedOwnAndInheritedFarmerRows.some((row) => row.executive === "Farmer Split QA" && row.customerName === "Cliente Split QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 25)) {
  throw new Error("Generated official rows did not keep inherited Studio renewal as a separate Studio billing row.");
}
if (!generatedOwnAndInheritedFarmerRows.some((row) => row.executive === "Farmer Split QA" && row.customerName === "Subtotal (na meta)" && row.farmerRenewal === 100)) {
  throw new Error("Generated official rows must subtotal Farmer/Delivery own renewal without adding inherited Studio renewal again.");
}

const generatedDirectorOfficialRows = buildOfficialRowsForView({
  view: "directors",
  peopleRows: [],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [
    {
      id: "director-own-renewal-qa",
      personId: "director-person-qa",
      customerId: "customer-director-qa",
      personName: "Director Person QA",
      roleType: "Delivery",
      customerName: "Cliente Director QA",
      segment: "Renovação + Ampliação",
      areaName: "",
      studioHunterName: "",
      amount: 125,
    },
    {
      id: "director-studio-maintenance-qa",
      personId: "director-person-qa",
      customerId: "customer-director-qa",
      personName: "Director Person QA",
      roleType: "Delivery",
      customerName: "Cliente Director QA",
      segment: "Studio Manutenção",
      areaName: "Salesforce",
      studioHunterName: "Director Person QA",
      amount: 25,
    },
    {
      id: "director-studio-hunter-qa",
      personId: "director-person-qa",
      customerId: "customer-director-qa",
      personName: "Director Person QA",
      roleType: "Hunter",
      customerName: "Cliente Director QA",
      segment: "Studio Hunter",
      areaName: "Google - Alianças",
      studioHunterName: "Director Person QA",
      amount: 40,
    },
  ],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [],
  allocations: [],
  studioAllocations: [],
  customerNames: new Map(),
  areaNames: new Map(),
  year: 2026,
});
if (!generatedDirectorOfficialRows.some((row) => row.executive === "Director Person QA" && row.customerName === "Cliente Director QA" && row.billingCustomer === "Squads/Times" && row.farmerRenewal === 100)) {
  throw new Error("Director official rows must keep own renewal separate from inherited Studio rows.");
}
if (!generatedDirectorOfficialRows.some((row) => row.executive === "Director Person QA" && row.customerName === "Cliente Director QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 25)) {
  throw new Error("Director official rows must write Studio Manutenção in Cliente Faturamento.");
}
if (!generatedDirectorOfficialRows.some((row) => row.executive === "Director Person QA" && row.customerName === "Cliente Director QA" && row.billingCustomer === "Google - Alianças" && row.hunter === 40)) {
  throw new Error("Director official rows must write Studio Hunter in Cliente Faturamento.");
}

const generatedDirectorCanonicalOfficialRows = buildOfficialRowsForView({
  view: "directors",
  peopleRows: [],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [
    {
      id: "director-canonical-own-hunter-qa",
      personId: "director-canonical-hunter-qa",
      customerId: "customer-director-canonical-qa",
      personName: "Director Canonical Hunter QA",
      roleType: "Hunter",
      customerName: "Cliente Director Canonical QA",
      segment: "Meta Hunter",
      areaName: "",
      studioHunterName: "",
      amount: 300,
    },
    {
      id: "director-canonical-studio-hunter-qa",
      personId: "director-canonical-hunter-qa",
      customerId: "customer-director-canonical-qa",
      personName: "Director Canonical Hunter QA",
      roleType: "Hunter",
      customerName: "Cliente Director Canonical QA",
      segment: "Studio Hunter",
      areaName: "Analytics",
      studioHunterName: "Director Canonical Hunter QA",
      amount: 100,
    },
  ],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "director-canonical-hunter-qa",
    name: "Director Canonical Hunter QA",
    roleType: "Hunter",
    active: true,
    clientIds: ["customer-director-canonical-qa"],
  }],
  allocations: [{
    id: "target-director-canonical-hunter-qa",
    customerId: "customer-director-canonical-qa",
    personId: "director-canonical-hunter-qa",
    type: "hunter",
    year: 2026,
    amount: 300,
    ownAmount: 300,
  }],
  studioAllocations: [{
    id: "studio-director-canonical-hunter-qa",
    customerId: "customer-director-canonical-qa",
    areaId: "studio-director-canonical-analytics",
    hunterPersonId: "director-canonical-hunter-qa",
    year: 2026,
    hunterAmount: 100,
    maintenanceAmount: 0,
  }],
  customerNames: new Map([["customer-director-canonical-qa", "Cliente Director Canonical QA"]]),
  areaNames: new Map([["studio-director-canonical-analytics", "Analytics"]]),
  year: 2026,
});
if (!generatedDirectorCanonicalOfficialRows.some((row) => row.executive === "Director Canonical Hunter QA" && row.customerName === "Cliente Director Canonical QA" && row.billingCustomer === "Squads/Times" && row.hunter === 200)) {
  throw new Error("Director official rows must compute Meta Squads/Times as current Hunter minus inherited Studio Hunter from canonical sources.");
}
if (!generatedDirectorCanonicalOfficialRows.some((row) => row.executive === "Director Canonical Hunter QA" && row.customerName === "Cliente Director Canonical QA" && row.billingCustomer === "Analytics" && row.hunter === 100)) {
  throw new Error("Director official rows must keep inherited Studio Hunter as a separate Studio billing row from canonical sources.");
}
if (!generatedDirectorCanonicalOfficialRows.some((row) => row.executive === "Director Canonical Hunter QA" && row.customerName === "Subtotal (na meta)" && row.hunter === 200)) {
  throw new Error("Director official subtotal must not add inherited Studio Hunter again.");
}

const generatedDirectorCanonicalFarmerOfficialRows = buildOfficialRowsForView({
  view: "directors",
  peopleRows: [],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [
    {
      id: "director-canonical-own-farmer-qa",
      personId: "director-canonical-farmer-qa",
      customerId: "customer-director-canonical-farmer-qa",
      personName: "Director Canonical Farmer QA",
      roleType: "Delivery",
      customerName: "Cliente Director Farmer QA",
      segment: "Renovação + Ampliação",
      areaName: "",
      studioHunterName: "",
      amount: 500,
    },
    {
      id: "director-canonical-studio-maintenance-qa",
      personId: "director-canonical-farmer-qa",
      customerId: "customer-director-canonical-farmer-qa",
      personName: "Director Canonical Farmer QA",
      roleType: "Delivery",
      customerName: "Cliente Director Farmer QA",
      segment: "Studio Manutenção",
      areaName: "Salesforce",
      studioHunterName: "Director Canonical Farmer QA",
      amount: 150,
    },
  ],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "director-canonical-farmer-qa",
    name: "Director Canonical Farmer QA",
    roleType: "Delivery",
    active: true,
    clientIds: ["customer-director-canonical-farmer-qa"],
  }],
  allocations: [{
    id: "target-director-canonical-farmer-qa",
    customerId: "customer-director-canonical-farmer-qa",
    personId: "director-canonical-farmer-qa",
    type: "farmer_renewal",
    year: 2026,
    amount: 500,
    ownAmount: 500,
  }],
  studioAllocations: [{
    id: "studio-director-canonical-maintenance-qa",
    customerId: "customer-director-canonical-farmer-qa",
    areaId: "studio-director-canonical-salesforce",
    maintenancePersonId: "director-canonical-farmer-qa",
    year: 2026,
    hunterAmount: 0,
    maintenanceAmount: 150,
  }],
  customerNames: new Map([["customer-director-canonical-farmer-qa", "Cliente Director Farmer QA"]]),
  areaNames: new Map([["studio-director-canonical-salesforce", "Salesforce"]]),
  year: 2026,
});
if (!generatedDirectorCanonicalFarmerOfficialRows.some((row) => row.executive === "Director Canonical Farmer QA" && row.customerName === "Cliente Director Farmer QA" && row.billingCustomer === "Squads/Times" && row.farmerRenewal === 350)) {
  throw new Error("Director official rows must compute Farmer/Delivery Squads/Times as current renewal minus inherited Studio maintenance from canonical sources.");
}
if (!generatedDirectorCanonicalFarmerOfficialRows.some((row) => row.executive === "Director Canonical Farmer QA" && row.customerName === "Cliente Director Farmer QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 150)) {
  throw new Error("Director official rows must keep inherited Studio maintenance as a separate Studio billing row from canonical sources.");
}
if (!generatedDirectorCanonicalFarmerOfficialRows.some((row) => row.executive === "Director Canonical Farmer QA" && row.customerName === "Subtotal (na meta)" && row.farmerRenewal === 350)) {
  throw new Error("Director official subtotal must not add inherited Studio maintenance again.");
}

const generatedHunterClientOfficialRows = buildOfficialRowsForView({
  view: "hunterClients",
  peopleRows: [],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [
    {
      id: "hunter-client-own-qa",
      hunterId: "hunter-client-qa",
      hunterName: "Hunter Client QA",
      customerId: "customer-hunter-client-qa",
      customerName: "Cliente Hunter Client QA",
      detailName: "Meta Hunter",
      segment: "Meta Squads/Times Hunter",
      hunterAmount: 100,
      maintenanceAmount: 0,
      total: 100,
      observations: "",
    },
    {
      id: "hunter-client-studio-hunter-qa",
      hunterId: "hunter-client-qa",
      hunterName: "Hunter Client QA",
      customerId: "customer-hunter-client-qa",
      customerName: "Cliente Hunter Client QA",
      detailName: "Google - Alianças",
      segment: "Studio Hunter",
      hunterAmount: 30,
      maintenanceAmount: 0,
      total: 30,
      observations: "",
    },
    {
      id: "hunter-client-studio-maintenance-qa",
      hunterId: "hunter-client-qa",
      hunterName: "Hunter Client QA",
      customerId: "customer-hunter-client-qa",
      customerName: "Cliente Hunter Client QA",
      detailName: "Salesforce",
      segment: "Studio Manutenção",
      hunterAmount: 0,
      maintenanceAmount: 20,
      total: 20,
      observations: "",
    },
  ],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [],
  allocations: [],
  studioAllocations: [],
  customerNames: new Map(),
  areaNames: new Map(),
  year: 2026,
});
if (!generatedHunterClientOfficialRows.some((row) => row.executive === "Hunter Client QA" && row.billingCustomer === "Squads/Times" && row.hunter === 100)) {
  throw new Error("Hunter x Clientes official rows must keep own Hunter target without billing Studio.");
}
if (!generatedHunterClientOfficialRows.some((row) => row.executive === "Hunter Client QA" && row.billingCustomer === "Google - Alianças" && row.hunter === 30)) {
  throw new Error("Hunter x Clientes official rows must write Studio Hunter in Cliente Faturamento.");
}
if (!generatedHunterClientOfficialRows.some((row) => row.executive === "Hunter Client QA" && row.billingCustomer === "Salesforce" && row.farmerRenewal === 20)) {
  throw new Error("Hunter x Clientes official rows must write Studio Manutenção in Cliente Faturamento.");
}

const generatedSpecialistHunterOfficialRows = buildOfficialRowsForView({
  view: "specialistHunters",
  peopleRows: [],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  specialistHunterRows: [
    {
      personName: "Especialista QA",
      customerName: "Cliente Especialista",
      areaName: "Google - Alianças",
      hunterAmount: 40,
      maintenanceAmount: 0,
      amount: 40,
      isPrincipalHunter: false,
    },
    {
      personName: "Especialista QA",
      customerName: "Cliente Principal",
      areaName: "Salesforce",
      hunterAmount: 10,
      maintenanceAmount: 0,
      amount: 10,
      isPrincipalHunter: true,
    },
  ],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [],
  allocations: [],
  studioAllocations: [],
  customerNames: new Map(),
  areaNames: new Map(),
  year: 2026,
});
if (!generatedSpecialistHunterOfficialRows.some((row) => row.executive === "Especialista QA" && row.customerName === "Cliente Especialista" && row.billingCustomer === "Google - Alianças" && row.hunter === 40)) {
  throw new Error("Specialist Hunter official rows must include regular managerial selections.");
}
if (!generatedSpecialistHunterOfficialRows.some((row) => row.executive === "Especialista QA - Hunter principal" && row.customerName === "Cliente Principal" && row.billingCustomer === "Salesforce" && row.hunter === 10 && row.farmerRenewal === 0)) {
  throw new Error("Specialist Hunter official rows must append Studio-backed principal Hunter accounts in a differentiated block.");
}

const generatedOfficialRows = buildOfficialRowsForView({
  view: "people",
  peopleRows: [{
    personId: "hunter-qa",
    personName: "Hunter QA",
    email: "hunter.qa@brq.com",
    roleType: "Hunter",
    directorId: undefined,
    customerCount: 1,
    customerNames: ["Cliente QA"],
    hunter: 300,
    farmerRenewal: 50,
    total: 350,
    customerBreakdown: [],
  }],
  hunterRows: [],
  hunterDetailRows: [],
  directorDetailRows: [],
  areaRows: [],
  areaDetailRows: [],
  hunterClientRows: [],
  selectedHunterNames: [],
  selectedAreaNames: [],
  people: [{
    id: "hunter-qa",
    name: "Hunter QA",
    roleType: "Hunter",
    active: true,
    clientIds: ["customer-qa"],
  }],
  allocations: [
    {
      id: "target-hunter-qa",
      customerId: "customer-qa",
      personId: "hunter-qa",
      type: "hunter",
      year: 2026,
      amount: 300,
      ownAmount: 200,
    },
    {
      id: "target-renewal-qa",
      customerId: "customer-qa",
      personId: "hunter-qa",
      type: "farmer_renewal",
      year: 2026,
      amount: 50,
    },
  ],
  studioAllocations: [
    {
      id: "studio-hunter-qa",
      customerId: "customer-qa",
      areaId: "studio-hunter",
      hunterPersonId: "hunter-qa",
      year: 2026,
      hunterAmount: 100,
      maintenanceAmount: 0,
    },
    {
      id: "studio-maintenance-qa",
      customerId: "customer-qa",
      areaId: "studio-maintenance",
      year: 2026,
      hunterAmount: 0,
      maintenanceAmount: 40,
    },
  ],
  customerNames: new Map([["customer-qa", "Cliente QA"]]),
  areaNames: new Map([
    ["studio-hunter", "Studio Hunter QA"],
    ["studio-maintenance", "Studio Manutenção QA"],
  ]),
  year: 2026,
});

const workbook = buildXlsxWorkbook({
  title: "Executivo e Cliente (R$) - FINANCIAL",
  generatedAt: "08/07/2026 22:00",
  worksheetName: "Resumo_Cliente",
  rows: generatedOfficialRows,
  columns: requiredOfficialColumns.map((label) => ({
    key: label,
    label,
    value: (row) => officialColumnValue(label, row),
    format: label === "% Novo" ? "percent" : ["Meta 2026", "Renovação (FARMER)", "Novo (HUNTER)"].includes(label) ? "currency" : "text",
  })),
  rowStyle: (row) => row.rowStyle,
  officialLayout: true,
});

const zip = unzipSync(new Uint8Array(workbook));
const sheetXml = strFromU8(zip["xl/worksheets/sheet1.xml"]);
const workbookXml = strFromU8(zip["xl/workbook.xml"]);
const generatedSheetName = workbookXml.match(/<sheet[^>]* name="([^"]+)"/)?.[1] ?? "";
const generatedDimension = sheetXml.match(/<dimension ref="([^"]+)"/)?.[1] ?? "";
const generatedAutoFilter = sheetXml.match(/<autoFilter ref="([^"]+)"/)?.[1] ?? "";
const generatedHeaders = readRowValues(sheetXml, 3);
const generatedBillingCustomer = readCellValueAt(sheetXml, "D4");
const generatedBusinessUnit = readCellValueAt(sheetXml, "E4");
const generatedStudioHunterBillingCustomer = readCellValueAt(sheetXml, "D5");
const generatedMaintenanceBillingCustomer = readCellValueAt(sheetXml, "D7");
const generatedOwnExecutive = readCellValueAt(sheetXml, "B4");
const generatedOwnCustomer = readCellValueAt(sheetXml, "C4");
const generatedOwnFarmer = readCellValueAt(sheetXml, "G4");
const generatedOwnHunter = readCellValueAt(sheetXml, "H4");
const generatedStudioHunterExecutive = readCellValueAt(sheetXml, "B5");
const generatedStudioHunterCustomer = readCellValueAt(sheetXml, "C5");
const generatedStudioHunterHunter = readCellValueAt(sheetXml, "H5");
const generatedMaintenanceExecutive = readCellValueAt(sheetXml, "B7");
const generatedMaintenanceCustomer = readCellValueAt(sheetXml, "C7");
const generatedMaintenanceFarmer = readCellValueAt(sheetXml, "G7");
const generatedMaintenanceHunter = readCellValueAt(sheetXml, "H7");
const generatedSubtotalTextStyle = readCellStyleAt(sheetXml, "B6");
const generatedSubtotalCurrencyStyle = readCellStyleAt(sheetXml, "F6");
const generatedSubtotalPercentStyle = readCellStyleAt(sheetXml, "I6");

if (generatedSheetName !== "Resumo_Cliente") {
  throw new Error(`Generated official workbook sheet mismatch: ${generatedSheetName}`);
}
if (generatedDimension !== "A1:I9") {
  throw new Error(`Generated official workbook dimension mismatch: ${generatedDimension}`);
}
if (generatedAutoFilter !== "A3:I9") {
  throw new Error(`Generated official workbook autoFilter mismatch: ${generatedAutoFilter}`);
}
if (JSON.stringify(generatedHeaders) !== JSON.stringify(requiredOfficialColumns)) {
  throw new Error(`Generated official workbook headers mismatch: ${generatedHeaders.join(" | ")}`);
}
if (generatedBillingCustomer !== "Squads/Times" || generatedBusinessUnit !== "Financial") {
  throw new Error(`Generated official workbook did not match D4/E4 defaults: D4=${generatedBillingCustomer}, E4=${generatedBusinessUnit}`);
}
if (generatedOwnExecutive !== "Hunter QA" || generatedOwnCustomer !== "Cliente QA" || generatedOwnFarmer !== "50" || generatedOwnHunter !== "200") {
  throw new Error(`Generated official workbook did not write the person own target row in row 4: B4=${generatedOwnExecutive}, C4=${generatedOwnCustomer}, G4=${generatedOwnFarmer}, H4=${generatedOwnHunter}`);
}
if (generatedStudioHunterExecutive !== "Hunter QA" || generatedStudioHunterCustomer !== "Cliente QA" || generatedStudioHunterBillingCustomer !== "Studio Hunter QA" || generatedStudioHunterHunter !== "100") {
  throw new Error(`Generated official workbook did not write Studio Hunter under the Hunter in row 5: B5=${generatedStudioHunterExecutive}, C5=${generatedStudioHunterCustomer}, D5=${generatedStudioHunterBillingCustomer}, H5=${generatedStudioHunterHunter}`);
}
if (generatedMaintenanceExecutive !== "Studio Manutenção QA" || generatedMaintenanceCustomer !== "Cliente QA" || generatedMaintenanceBillingCustomer !== "Studio Manutenção QA" || generatedMaintenanceFarmer !== "40" || generatedMaintenanceHunter !== "0") {
  throw new Error(`Generated official workbook did not write Studio Manutenção at the end by Studio/Cliente in row 7: B7=${generatedMaintenanceExecutive}, C7=${generatedMaintenanceCustomer}, D7=${generatedMaintenanceBillingCustomer}, G7=${generatedMaintenanceFarmer}, H7=${generatedMaintenanceHunter}`);
}
if (generatedSubtotalTextStyle !== "18" || generatedSubtotalCurrencyStyle !== "19" || generatedSubtotalPercentStyle !== "20") {
  throw new Error(`Generated official workbook did not bold subtotal row styles: B6=${generatedSubtotalTextStyle}, F6=${generatedSubtotalCurrencyStyle}, I6=${generatedSubtotalPercentStyle}`);
}
if (!sheetXml.includes("<f>G4+H4</f>") || !sheetXml.includes("<f>IF(F4=0,0,H4/F4)</f>") || !sheetXml.includes("<f>G5+H5</f>") || !sheetXml.includes("<f>G6+H6</f>") || !sheetXml.includes("<f>G7+H7</f>") || !sheetXml.includes("<f>G9+H9</f>")) {
  throw new Error("Generated official workbook is missing official formulas in Meta 2026 or % Novo.");
}

console.log("Report export QA checks passed.");

function officialColumnValue(label, row) {
  if (label === "BU/Área Executivo") return row.businessUnitArea;
  if (label === "Executivo") return row.executive;
  if (label === "Grupo Cliente") return row.customerName;
  if (label === "Cliente Faturamento") return row.billingCustomer;
  if (label === "BU") return row.businessUnit;
  if (label === "Meta 2026") return row.totalTarget;
  if (label === "Renovação (FARMER)") return row.farmerRenewal;
  if (label === "Novo (HUNTER)") return row.hunter;
  if (label === "% Novo") return row.hunterShare;
  return "";
}

function readRowValues(sheetXml, rowNumber) {
  const rowXml = sheetXml.match(new RegExp(`<row[^>]* r="${rowNumber}"[\\s\\S]*?<\\/row>`))?.[0] ?? "";
  return Array.from(rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g)).map((match) => {
    const attrs = match[1] ?? match[3] ?? "";
    const type = attrs.match(/ t="([^"]+)"/)?.[1];
    return match[2] ? readCellValue(type, match[2]) : "";
  });
}

function readCellValueAt(sheetXml, cellRef) {
  const escapedCellRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sheetXml.match(new RegExp(`<c([^>]*)\\sr="${escapedCellRef}"([^>]*)/>|<c([^>]*)\\sr="${escapedCellRef}"([^>]*)>([\\s\\S]*?)<\\/c>`));
  if (!match) return "";
  const attrs = `${match[1] ?? match[3] ?? ""}${match[2] ?? match[4] ?? ""}`;
  const type = attrs.match(/ t="([^"]+)"/)?.[1];
  return match[5] ? readCellValue(type, match[5]) : "";
}

function readCellStyleAt(sheetXml, cellRef) {
  const escapedCellRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sheetXml.match(new RegExp(`<c([^>]*)\\sr="${escapedCellRef}"([^>]*)/>|<c([^>]*)\\sr="${escapedCellRef}"([^>]*)>([\\s\\S]*?)<\\/c>`));
  if (!match) return "";
  const attrs = `${match[1] ?? match[3] ?? ""}${match[2] ?? match[4] ?? ""}`;
  return attrs.match(/ s="([^"]+)"/)?.[1] ?? "";
}

function readCellValue(type, body) {
  if (type === "inlineStr") {
    return decodeXml(Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => match[1]).join(""));
  }
  const formula = body.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1];
  const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  return formula ? `=${decodeXml(formula)}${value ? ` [${value}]` : ""}` : decodeXml(value);
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
