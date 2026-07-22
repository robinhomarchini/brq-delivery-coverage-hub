import type { Area, Customer, StudioTargetAllocation } from "@/data/mockData";
import {
  buildStudioBaselineComparisons,
  getStudioBaselineSource,
  isStudioHunterOpportunity,
  type StudioBaselineRow,
  type StudioBaselineComparisonRow,
  type StudioBaselineSnapshot,
} from "@/lib/studio-baseline-import";
import {
  buildStudioBaselineReportRows,
  type StudioBaselineReportRow,
} from "@/lib/studio-baseline-report";
import type { TargetBaselineComparison } from "@/lib/target-baseline-import";
import { normalizeBusinessName, roundCurrency } from "@/lib/utils";

type StudioCurveSnapshotInput = {
  curveStudioRows: StudioBaselineRow[];
  comparisons: TargetBaselineComparison[];
  customers: Customer[];
  areas: Area[];
  studioTargetAllocations: StudioTargetAllocation[];
  year: number;
  fileName: string;
};

const curveSheetColumns = {
  salesUnit: 0, // A - SU
  allianceLabel: 2, // C - Parceiro/fornecedor usado para classificar alianças
  customerName: 3, // D - Grupo Cliente
  revenueStream: 9, // J - Revenue Stream
  studioName: 11, // L - Studio/Habilitador
  opportunityType: 14, // O - Tipo Opp (Renovação/Novo-ampliação)
  totalAmount: 33, // AH - Total RL 2026
  businessUnit: 69, // BR - CC CROSS
};

export function buildStudioCurveBaselineSnapshotInput({
  curveStudioRows,
  comparisons,
  customers,
  areas,
  studioTargetAllocations,
  year,
  fileName,
}: StudioCurveSnapshotInput): Omit<StudioBaselineSnapshot, "id" | "createdAt"> | null {
  const source = getStudioBaselineSource("studio_general");
  const rows = buildStudioCurveBaselineComparisonRows(
    curveStudioRows,
    comparisons,
    customers,
    areas,
    studioTargetAllocations,
    year,
  );
  if (!rows.length) return null;

  const reportRows = rows.flatMap((row) =>
    buildStudioBaselineReportRows(row, year, {
      sourceNote: "Gerado automaticamente pela importação da Curva principal.",
      allocatedDifferenceLabel: "Diferença entre a alocação detalhada em Studios e a Curva principal filtrada por BU Financial.",
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

export function parseCurveStudioBaselineRows(rows: unknown[][]): StudioBaselineRow[] {
  const grouped = new Map<string, StudioBaselineRow>();

  rows.forEach((row, index) => {
    const salesUnit = String(row[curveSheetColumns.salesUnit] ?? "").trim();
    const businessUnit = String(row[curveSheetColumns.businessUnit] ?? "").trim();
    if (!isFinancialBusinessUnit(businessUnit)) return;

    const customerName = String(row[curveSheetColumns.customerName] ?? "").trim();
    const allianceLabel = String(row[curveSheetColumns.allianceLabel] ?? "").trim();
    const revenueStream = String(row[curveSheetColumns.revenueStream] ?? "").trim();
    const rawStudioName = String(row[curveSheetColumns.studioName] ?? "").trim();
    const studioName = getEligibleCurveStudioName(rawStudioName, revenueStream, customerName, allianceLabel, salesUnit);
    const opportunityType = String(row[curveSheetColumns.opportunityType] ?? "").trim();
    const amount = parseMoney(row[curveSheetColumns.totalAmount]);
    if (!customerName || !studioName || amount <= 0) return;

    const key = `${normalizeBusinessName(customerName)}:${normalizeBusinessName(studioName)}`;
    const current = grouped.get(key) ?? {
      rowNumber: index + 1,
      salesUnit: "Curva principal",
      tower: "Sheet1",
      businessUnit,
      customerName,
      studioName,
      opportunityType: "",
      hunterAmount: 0,
      maintenanceAmount: 0,
      totalAmount: 0,
    };

    if (isStudioHunterOpportunity(opportunityType)) {
      current.hunterAmount = roundCurrency(current.hunterAmount + amount);
    } else {
      current.maintenanceAmount = roundCurrency(current.maintenanceAmount + amount);
    }
    current.opportunityType = [current.opportunityType, opportunityType].filter(Boolean).join(" / ");
    current.totalAmount = roundCurrency(current.hunterAmount + current.maintenanceAmount);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((first, second) =>
    first.customerName.localeCompare(second.customerName, "pt-BR")
    || first.studioName.localeCompare(second.studioName, "pt-BR")
  );
}

function getEligibleCurveStudioName(studioName: string, revenueStream: string, customerName: string, allianceLabel: string, salesUnit: string) {
  const normalizedStudio = normalizeBusinessName(studioName);
  if (!normalizedStudio || normalizedStudio === "squad" || normalizedStudio === "times") {
    return "";
  }

  if (normalizedStudio === "arquitetura") {
    return normalizeBusinessName(salesUnit) === "weme" ? "PX" : "";
  }

  if (normalizedStudio === "cloud" || normalizedStudio === "resell") {
    const allianceStudioName = getAllianceStudioName(customerName, allianceLabel, revenueStream);
    if (allianceStudioName) return allianceStudioName;
    if (normalizedStudio === "resell") return "";
    if (isManagedServicesLabel(customerName) || isManagedServicesLabel(allianceLabel)) return "Managed Services";
    return isManagedServicesLabel(revenueStream) ? "Managed Services" : "";
  }

  return studioName;
}

function getAllianceStudioName(customerName: string, allianceLabel: string, revenueStream: string) {
  const normalizedLabels = [customerName, allianceLabel, revenueStream].map((value) => normalizeBusinessName(value));
  if (normalizedLabels.some((label) => label === "google llc" || label.includes("google llc"))) return "Alianças Google";
  if (normalizedLabels.some((label) => label === "microsoft" || label.includes("microsoft"))) return "Alianças Microsoft";
  if (normalizedLabels.some((label) => label === "amazon web" || label.includes("amazon web"))) return "Alianças AWS";
  if (normalizedLabels.some((label) => label.includes("datadog") || label.includes("data dog"))) return "Datadog-Alianças";
  return "";
}

function isManagedServicesLabel(value: string) {
  const normalized = normalizeBusinessName(value);
  return normalized === "managed services / finops" || normalized === "managed services";
}

function isFinancialBusinessUnit(value: string) {
  const normalized = normalizeBusinessName(value);
  return normalized === "financial" || normalized === "bu financial";
}

function buildStudioCurveBaselineComparisonRows(
  curveStudioRows: StudioBaselineRow[],
  comparisons: TargetBaselineComparison[],
  customers: Customer[],
  areas: Area[],
  studioTargetAllocations: StudioTargetAllocation[],
  year: number,
): StudioBaselineComparisonRow[] {
  const importedTargetsByCustomer = new Map(
    comparisons
      .filter((comparison) => comparison.valueStatus !== "invalid_total")
      .map((comparison) => [normalizeBusinessName(comparison.row.customerName), comparison])
  );

  return buildStudioBaselineComparisons(curveStudioRows, customers, areas, studioTargetAllocations, year)
    .map((row) => {
      const targetComparison = importedTargetsByCustomer.get(normalizeBusinessName(row.customerName));
      if (!targetComparison) return row;

      return {
        ...row,
        registeredCustomerHunterTarget: roundCurrency(targetComparison.effectiveHunterTarget),
        registeredCustomerMaintenanceTarget: roundCurrency(targetComparison.effectiveFarmerRenewalTarget),
        registeredCustomerStudioHunterTarget: roundCurrency(row.baselineHunter),
        registeredCustomerStudioMaintenanceTarget: roundCurrency(row.baselineMaintenance),
        registeredCustomerStudioTarget: roundCurrency(row.baselineTotal),
        registeredCustomerTotalTarget: roundCurrency(targetComparison.effectiveRevenue),
      };
    })
    .sort((first, second) =>
      first.customerName.localeCompare(second.customerName, "pt-BR", { sensitivity: "base", numeric: true })
      || first.studioName.localeCompare(second.studioName, "pt-BR", { sensitivity: "base", numeric: true })
    );
}

function getStudioCurveSnapshotTotals(rows: StudioBaselineReportRow[]) {
  return rows.reduce((totals, row) => ({
    baselineTotal: (row.view === "Baseline" || row.view === "Baseline Studio") ? roundCurrency(totals.baselineTotal + row.totalAmount) : totals.baselineTotal,
    allocatedTotal: (row.view === "Alocado" || row.view === "Cadastrado") ? roundCurrency(totals.allocatedTotal + row.totalAmount) : totals.allocatedTotal,
    curveStudioTotal: row.view === "Baseline Curva" ? roundCurrency(totals.curveStudioTotal + row.totalAmount) : totals.curveStudioTotal,
    allocationDelta: (row.view === "Alocado" || row.view === "Cadastrado") ? roundCurrency(totals.allocationDelta + row.difference) : totals.allocationDelta,
  }), {
    baselineTotal: 0,
    allocatedTotal: 0,
    curveStudioTotal: 0,
    allocationDelta: 0,
  });
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return roundCurrency(value);
  if (typeof value !== "string") return 0;

  const normalized = value
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : 0;
}
