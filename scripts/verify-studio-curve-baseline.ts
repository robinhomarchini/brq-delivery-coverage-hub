import type { Area, Customer, StudioTargetAllocation } from "../src/data/mockData";
import { applyCurveBaselineToStudioComparisons, buildStudioBaselineComparisons, refreshStudioBaselineComparisonsFromCurrentData, type StudioBaselineComparisonRow, type StudioBaselineRow } from "../src/lib/studio-baseline-import";
import { parseCurveCustomerBenchmarkRows, parseCurveStudioBaselineRows } from "../src/lib/studio-curve-baseline-snapshot";

const curveSheetColumns = {
  salesUnit: 0,
  allianceLabel: 2,
  customerName: 3,
  revenueStream: 9,
  studioName: 11,
  opportunityType: 14,
  totalAmount: 33,
  businessUnit: 69,
};

const rows = [
  makeCurveRow({
    customerName: "Votorantim",
    allianceLabel: "Google LLC",
    revenueStream: "Google LLC",
    studioName: "Cloud",
    opportunityType: "Novo Projeto / Hunter",
    totalAmount: 700000,
  }),
  makeCurveRow({
    customerName: "Votorantim",
    allianceLabel: "Managed Services",
    revenueStream: "Managed Services / FinOps",
    studioName: "Cloud",
    opportunityType: "Renovação",
    totalAmount: 285394,
  }),
  makeCurveRow({
    customerName: "Votorantim",
    allianceLabel: "Google LLC",
    revenueStream: "Google LLC",
    studioName: "Cloud",
    opportunityType: "Renovação",
    totalAmount: 1000,
    businessUnit: "BU Non Financial",
  }),
  makeCurveRow({
    customerName: "Votorantim",
    revenueStream: "Times",
    studioName: "Times",
    opportunityType: "Renovação",
    totalAmount: 500000,
  }),
  makeCurveRow({
    customerName: "Votorantim",
    revenueStream: "Squad",
    studioName: "Squad",
    opportunityType: "Novo Projeto / Hunter",
    totalAmount: 250000,
  }),
  makeCurveRow({
    customerName: "Cliente Google Resell",
    allianceLabel: "Google LLC",
    revenueStream: "Resell",
    studioName: "RESELL",
    opportunityType: "Novo Projeto / Hunter",
    totalAmount: 200000,
  }),
  makeCurveRow({
    customerName: "Cliente Datadog Resell",
    allianceLabel: "Data Dog",
    revenueStream: "Resell",
    studioName: "RESELL",
    opportunityType: "Renovação",
    totalAmount: 150000,
  }),
  makeCurveRow({
    customerName: "Cliente Analytics",
    revenueStream: "Analytics",
    studioName: "Analytics",
    opportunityType: "Renovação + Ampliação",
    totalAmount: 7123456,
    businessUnit: "Financial",
  }),
  makeCurveRow({
    customerName: "Parceiro sem Studio",
    revenueStream: "Resell",
    studioName: "RESELL",
    opportunityType: "Novo Projeto / Hunter",
    totalAmount: 999999,
  }),
];

const parsed = parseCurveStudioBaselineRows(rows);
const googleAlliance = parsed.find((row) => row.customerName === "Votorantim" && row.studioName === "Alianças Google");
const managedServices = parsed.find((row) => row.customerName === "Votorantim" && row.studioName === "Managed Services");
const googleResellAlliance = parsed.find((row) => row.customerName === "Cliente Google Resell" && row.studioName === "Alianças Google");
const datadogResellAlliance = parsed.find((row) => row.customerName === "Cliente Datadog Resell" && row.studioName === "Datadog-Alianças");
const analyticsRenewal = parsed.find((row) => row.customerName === "Cliente Analytics" && row.studioName === "Analytics");
const unknownResell = parsed.find((row) => row.customerName === "Parceiro sem Studio");

assert(googleAlliance, "Votorantim Cloud + Google LLC must become Alianças Google.");
assert(googleAlliance.hunterAmount === 700000, "Votorantim Google alliance amount must be captured as Hunter.");
assert(googleAlliance.maintenanceAmount === 0, "Votorantim Google alliance must not leak maintenance amount.");
assert(managedServices, "Votorantim Cloud + Managed Services revenue stream must become Managed Services.");
assert(managedServices.maintenanceAmount === 285394, "Votorantim Managed Services amount must be captured as maintenance.");
assert(googleResellAlliance, "RESELL rows with Google in column C must become Alianças Google while using column D as customer.");
assert(googleResellAlliance.hunterAmount === 200000, "Google RESELL amount must follow Tipo Opp and enter Hunter.");
assert(datadogResellAlliance, "RESELL rows with Data Dog in column C must become Datadog-Alianças while using column D as customer.");
assert(datadogResellAlliance.maintenanceAmount === 150000, "Datadog RESELL amount must follow Tipo Opp and enter maintenance.");
assert(analyticsRenewal, "Analytics renewal rows must enter the Studio Curve baseline.");
assert(analyticsRenewal.hunterAmount === 0, "Analytics Renovação + Ampliação must not be classified as Hunter.");
assert(analyticsRenewal.maintenanceAmount === 7123456, "Analytics Renovação + Ampliação must be captured as maintenance.");
assert(!unknownResell, "Unrecognized RESELL rows must stay out of the Studio Curve baseline.");
assert(parsed.length === 5, "Only Financial and recognized Studio Curve rows must enter the baseline.");

const benchmarkRows = parseCurveCustomerBenchmarkRows(rows);
const votorantimBenchmark = benchmarkRows.find((row) => row.customerName === "Votorantim");

assert(votorantimBenchmark, "Votorantim must have a customer benchmark split from Sheet1.");
assert(votorantimBenchmark.timesTarget === 750000, "Times/Squad buckets must enter the customer benchmark as Times/Squads.");
assert(votorantimBenchmark.digitalOfferTarget === 985394, "Recognized Studio/Habilitador rows must enter the customer benchmark as Oferta Digital.");
assert(votorantimBenchmark.totalTarget === 1735394, "Customer benchmark total must sum Times/Squads and Oferta Digital.");

const awsAliasComparison = buildStudioBaselineComparisons(
  [makeStudioBaselineRow({ customerName: "Alelo", studioName: "Alianças AWS", hunterAmount: 400000 })],
  [makeCustomer({ id: "customer-alelo", name: "Alelo" })],
  [makeArea({ id: "area-aws", name: "AWS-Alianças" })],
  [makeStudioAllocation({ customerId: "customer-alelo", areaId: "area-aws", hunterAmount: 400000 })],
  2026,
)[0];

assert(awsAliasComparison, "AWS alias comparison must return one row.");
assert(awsAliasComparison.status === "ok", "Alianças AWS baseline must match AWS-Alianças registered Studio.");
assert(awsAliasComparison.registeredStudioName === "AWS-Alianças", "AWS alias comparison must preserve the registered Studio name.");
assert(awsAliasComparison.allocatedHunter === 400000, "AWS alias comparison must use the registered allocation.");

const refreshedSnapshotComparison = refreshStudioBaselineComparisonsFromCurrentData(
  [makeRestoredComparisonRow({
    customerName: "Alelo",
    studioName: "Alianças AWS",
    baselineHunter: 400000,
    baselineTotal: 400000,
    status: "missing_studio",
  })],
  [makeCustomer({ id: "customer-alelo", name: "Alelo" })],
  [makeArea({ id: "area-aws", name: "AWS-Alianças" })],
  [makeStudioAllocation({ customerId: "customer-alelo", areaId: "area-aws", hunterAmount: 400000 })],
  2026,
)[0];

assert(refreshedSnapshotComparison, "Restored snapshot comparison must be refreshed.");
assert(refreshedSnapshotComparison.status === "ok", "Restored missing Studio snapshot must be refreshed against current registered Studios.");
assert(refreshedSnapshotComparison.registeredStudioName === "AWS-Alianças", "Refreshed snapshot comparison must preserve the current registered Studio name.");

const studioSpecificPxBaseline = makeRestoredComparisonRow({
  customerName: "Alelo",
  studioName: "PX",
  baselineHunter: 2547693,
  baselineMaintenance: 2431414,
  baselineTotal: 4979107,
  status: "ok",
});
const curvePxBaseline = makeRestoredComparisonRow({
  customerName: "Alelo",
  studioName: "PX",
  baselineHunter: 3545076,
  baselineMaintenance: 5244031,
  baselineTotal: 8789107,
  status: "allocation_gap",
});
const studioComparisonWithCurve = applyCurveBaselineToStudioComparisons([studioSpecificPxBaseline], [curvePxBaseline])[0];

assert(studioComparisonWithCurve, "Studio-specific comparison must stay available after Curve overlay.");
assert(studioComparisonWithCurve.baselineTotal === 4979107, "General Studio view must preserve the source-specific Studio baseline.");
assert(studioComparisonWithCurve.registeredCustomerStudioTarget === 8789107, "Curve baseline must remain isolated in the Baseline Curva line.");

console.log("Studio Curve baseline QA checks passed.");

function makeCurveRow({
  customerName,
  allianceLabel = "",
  revenueStream,
  studioName,
  opportunityType,
  totalAmount,
  businessUnit = "BU Financial",
}: {
  customerName: string;
  allianceLabel?: string;
  revenueStream: string;
  studioName: string;
  opportunityType: string;
  totalAmount: number;
  businessUnit?: string;
}) {
  const row: unknown[] = [];
  row[curveSheetColumns.salesUnit] = "BRQ";
  row[curveSheetColumns.allianceLabel] = allianceLabel;
  row[curveSheetColumns.customerName] = customerName;
  row[curveSheetColumns.revenueStream] = revenueStream;
  row[curveSheetColumns.studioName] = studioName;
  row[curveSheetColumns.opportunityType] = opportunityType;
  row[curveSheetColumns.totalAmount] = totalAmount;
  row[curveSheetColumns.businessUnit] = businessUnit;
  return row;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeStudioBaselineRow(input: { customerName: string; studioName: string; hunterAmount?: number; maintenanceAmount?: number }): StudioBaselineRow {
  const hunterAmount = input.hunterAmount ?? 0;
  const maintenanceAmount = input.maintenanceAmount ?? 0;
  return {
    rowNumber: 1,
    salesUnit: "Curva principal",
    tower: "Sheet1",
    businessUnit: "BU Financial",
    customerName: input.customerName,
    studioName: input.studioName,
    opportunityType: "Novo Projeto / Hunter",
    hunterAmount,
    maintenanceAmount,
    totalAmount: hunterAmount + maintenanceAmount,
  };
}

function makeCustomer(input: { id: string; name: string }): Customer {
  return {
    id: input.id,
    name: input.name,
    industry: "Financial Services",
    directorResponsibleId: "director",
    managerResponsibleIds: [],
    hunterTarget: 0,
    farmerRenewalTarget: 0,
    studioHunterTarget: 0,
    studioTarget: 0,
    revenue: 0,
    margin: 0,
    strategicAccount: false,
    lifecycleStatus: "active",
  };
}

function makeArea(input: { id: string; name: string }): Area {
  return {
    id: input.id,
    name: input.name,
    description: input.name,
  };
}

function makeStudioAllocation(input: { customerId: string; areaId: string; hunterAmount?: number; maintenanceAmount?: number }): StudioTargetAllocation {
  return {
    id: `studio-${input.customerId}-${input.areaId}`,
    customerId: input.customerId,
    areaId: input.areaId,
    year: 2026,
    hunterAmount: input.hunterAmount ?? 0,
    maintenanceAmount: input.maintenanceAmount ?? 0,
  };
}

function makeRestoredComparisonRow(input: {
  customerName: string;
  studioName: string;
  baselineHunter?: number;
  baselineMaintenance?: number;
  baselineTotal?: number;
  status?: StudioBaselineComparisonRow["status"];
}): StudioBaselineComparisonRow {
  return {
    key: `${input.customerName}:${input.studioName}`,
    customerName: input.customerName,
    registeredCustomerName: "",
    studioName: input.studioName,
    registeredStudioName: "",
    registeredCustomerHunterTarget: 0,
    registeredCustomerMaintenanceTarget: 0,
    registeredCustomerStudioHunterTarget: 0,
    registeredCustomerStudioMaintenanceTarget: 0,
    registeredCustomerStudioTarget: 0,
    registeredCustomerTotalTarget: 0,
    baselineHunter: input.baselineHunter ?? 0,
    baselineMaintenance: input.baselineMaintenance ?? 0,
    baselineTotal: input.baselineTotal ?? 0,
    allocatedHunter: 0,
    allocatedMaintenance: 0,
    allocatedTotal: 0,
    hunterDelta: 0,
    maintenanceDelta: 0,
    allocationDelta: 0,
    status: input.status ?? "allocation_gap",
  };
}
