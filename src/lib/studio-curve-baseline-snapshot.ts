import type { StudioTargetAllocation } from "@/data/mockData";
import {
  getStudioBaselineSource,
  type StudioBaselineComparisonRow,
  type StudioBaselineSnapshot,
} from "@/lib/studio-baseline-import";
import {
  buildStudioBaselineReportRows,
  type StudioBaselineReportRow,
} from "@/lib/studio-baseline-report";
import type { TargetBaselineComparison } from "@/lib/target-baseline-import";
import { roundCurrency } from "@/lib/utils";

type StudioCurveSnapshotInput = {
  comparisons: TargetBaselineComparison[];
  studioTargetAllocations: StudioTargetAllocation[];
  year: number;
  fileName: string;
};

export function buildStudioCurveBaselineSnapshotInput({
  comparisons,
  studioTargetAllocations,
  year,
  fileName,
}: StudioCurveSnapshotInput): Omit<StudioBaselineSnapshot, "id" | "createdAt"> | null {
  const source = getStudioBaselineSource("studio_general");
  const rows = buildStudioCurveBaselineComparisonRows(comparisons, studioTargetAllocations, year);
  if (!rows.length) return null;

  const reportRows = rows.flatMap((row) =>
    buildStudioBaselineReportRows(row, year, {
      sourceNote: "Gerado automaticamente pela importação da Curva principal.",
      allocatedDifferenceLabel: "Diferença entre a alocação detalhada em Studios e a Curva principal.",
      includeDifferenceLabels: true,
    })
  );

  return {
    year,
    sourceCode: source.code,
    sourceName: source.name,
    fileName: fileName || `curva-principal-${year}.xlsx`,
    rows: reportRows,
    totals: getStudioCurveSnapshotTotals(reportRows),
  };
}

function buildStudioCurveBaselineComparisonRows(
  comparisons: TargetBaselineComparison[],
  studioTargetAllocations: StudioTargetAllocation[],
  year: number,
): StudioBaselineComparisonRow[] {
  const allocationsByCustomer = summarizeStudioAllocationsByCustomer(studioTargetAllocations, year);

  return comparisons
    .filter((comparison) => comparison.valueStatus !== "invalid_total")
    .map((comparison) => {
      const allocated = comparison.customer
        ? allocationsByCustomer.get(comparison.customer.id) ?? { hunter: 0, maintenance: 0, total: 0 }
        : { hunter: 0, maintenance: 0, total: 0 };
      const curveStudioTarget = roundCurrency(comparison.effectiveStudioTarget);
      const baselineTotal = curveStudioTarget;
      const allocationDelta = roundCurrency(allocated.total - baselineTotal);

      return {
        key: `${comparison.row.customerName}:Baseline Curva`,
        customerName: comparison.row.customerName,
        registeredCustomerName: comparison.matchedCustomerName ?? "",
        studioName: "Baseline Curva",
        registeredStudioName: "Baseline Curva",
        registeredCustomerHunterTarget: roundCurrency(comparison.effectiveHunterTarget),
        registeredCustomerMaintenanceTarget: roundCurrency(comparison.effectiveFarmerRenewalTarget),
        registeredCustomerStudioTarget: curveStudioTarget,
        registeredCustomerTotalTarget: roundCurrency(comparison.effectiveRevenue),
        baselineHunter: 0,
        baselineMaintenance: baselineTotal,
        baselineTotal,
        allocatedHunter: allocated.hunter,
        allocatedMaintenance: allocated.maintenance,
        allocatedTotal: allocated.total,
        hunterDelta: allocated.hunter,
        maintenanceDelta: roundCurrency(allocated.maintenance - baselineTotal),
        allocationDelta,
        status: comparison.customer
          ? Math.abs(allocationDelta) <= 0.01 ? "ok" : "allocation_gap"
          : "missing_customer",
      } satisfies StudioBaselineComparisonRow;
    })
    .filter((row) => row.registeredCustomerStudioTarget > 0.01 || row.allocatedTotal > 0.01)
    .sort((first, second) => first.customerName.localeCompare(second.customerName, "pt-BR"));
}

function summarizeStudioAllocationsByCustomer(
  allocations: StudioTargetAllocation[],
  year: number,
) {
  const totals = new Map<string, { hunter: number; maintenance: number; total: number }>();

  allocations
    .filter((allocation) => allocation.year === year)
    .forEach((allocation) => {
      const current = totals.get(allocation.customerId) ?? { hunter: 0, maintenance: 0, total: 0 };
      current.hunter = roundCurrency(current.hunter + allocation.hunterAmount);
      current.maintenance = roundCurrency(current.maintenance + allocation.maintenanceAmount);
      current.total = roundCurrency(current.hunter + current.maintenance);
      totals.set(allocation.customerId, current);
    });

  return totals;
}

function getStudioCurveSnapshotTotals(rows: StudioBaselineReportRow[]) {
  return rows.reduce((totals, row) => ({
    baselineTotal: row.view === "Baseline" ? roundCurrency(totals.baselineTotal + row.totalAmount) : totals.baselineTotal,
    allocatedTotal: row.view === "Alocado" ? roundCurrency(totals.allocatedTotal + row.totalAmount) : totals.allocatedTotal,
    curveStudioTotal: row.view === "Baseline Curva" ? roundCurrency(totals.curveStudioTotal + row.totalAmount) : totals.curveStudioTotal,
    allocationDelta: row.view === "Alocado" ? roundCurrency(totals.allocationDelta + row.difference) : totals.allocationDelta,
  }), {
    baselineTotal: 0,
    allocatedTotal: 0,
    curveStudioTotal: 0,
    allocationDelta: 0,
  });
}
