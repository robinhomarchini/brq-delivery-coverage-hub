import { parseCurveStudioBaselineRows } from "../src/lib/studio-curve-baseline-snapshot";

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
assert(!unknownResell, "Unrecognized RESELL rows must stay out of the Studio Curve baseline.");
assert(parsed.length === 4, "Only Financial and recognized Studio Curve rows must enter the baseline.");

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
