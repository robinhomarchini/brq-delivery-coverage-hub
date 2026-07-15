import { restoreStudioBaselineComparisonRows, type StudioBaselineReportRow } from "../src/lib/studio-baseline-report";

const rows: StudioBaselineReportRow[] = [
  makeReportRow({
    view: "Baseline Studio",
    hunterAmount: 2547693,
    maintenanceAmount: 2431414,
    totalAmount: 4979107,
    difference: 0,
    status: "Alocação divergente",
  }),
  makeReportRow({
    view: "Cadastrado",
    hunterAmount: 2547693,
    maintenanceAmount: 2431414,
    totalAmount: 4979107,
    difference: -0.2,
    status: "Alocação divergente",
  }),
  makeReportRow({
    view: "Baseline Curva",
    hunterAmount: 2547693,
    maintenanceAmount: 2431414,
    totalAmount: 4979107,
    difference: -0.2,
    status: "Alocação divergente",
  }),
];

const restored = restoreStudioBaselineComparisonRows(rows);
const aleloPx = restored.find((row) => row.customerName === "ALELO" && row.studioName === "PX");

assert(aleloPx, "Studio baseline report must restore ALELO/PX.");
assert(aleloPx.status === "ok", "Displayed zero differences must restore as OK, not Alocação divergente.");
assert(aleloPx.allocationDelta === 0, "Displayed zero allocation delta must be normalized to 0.");

console.log("Studio baseline report QA checks passed.");

function makeReportRow(input: Pick<StudioBaselineReportRow, "view" | "hunterAmount" | "maintenanceAmount" | "totalAmount" | "difference" | "status">): StudioBaselineReportRow {
  return {
    key: `ALELO:PX:${input.view}`,
    customerName: "ALELO",
    studioName: "PX",
    view: input.view,
    hunterAmount: input.hunterAmount,
    maintenanceAmount: input.maintenanceAmount,
    totalAmount: input.totalAmount,
    customerHunterTarget: 11033497,
    customerMaintenanceTarget: 3177599,
    customerStudioHunterTarget: 2547693,
    customerStudioMaintenanceTarget: 2431414,
    customerStudioTarget: 4979107,
    customerTotalTarget: 14211096,
    difference: input.difference,
    hunterDelta: 0,
    maintenanceDelta: 0,
    status: input.status,
    year: 2026,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
