import { normalizeStudioCurrencyDelta, type StudioBaselineComparisonRow } from "@/lib/studio-baseline-import";
import { roundCurrency } from "@/lib/utils";

export type StudioBaselineReportView = "Baseline Studio" | "Cadastrado" | "Hunters / Alocações" | "Baseline Curva" | "Baseline" | "Alocado";

export type StudioBaselineReportRow = {
  key: string;
  customerName: string;
  studioName: string;
  sourceNote?: string;
  view: StudioBaselineReportView;
  hunterAmount: number;
  maintenanceAmount: number;
  totalAmount: number;
  customerHunterTarget: number;
  customerMaintenanceTarget: number;
  customerStudioHunterTarget: number;
  customerStudioMaintenanceTarget: number;
  customerStudioTarget: number;
  customerTotalTarget: number;
  difference: number;
  hunterDelta: number;
  maintenanceDelta: number;
  differenceLabel?: string;
  status: string;
  year: number;
};

type BuildStudioBaselineReportOptions = {
  sourceNote?: string;
  allocatedDifferenceLabel?: string;
  includeDifferenceLabels?: boolean;
};

export function buildStudioBaselineReportRows(
  row: StudioBaselineComparisonRow,
  year: number,
  options: BuildStudioBaselineReportOptions = {},
): StudioBaselineReportRow[] {
  const base = {
    customerName: row.customerName,
    studioName: row.studioName,
    sourceNote: options.sourceNote ?? "",
    status: getStudioStatusLabel(row.status),
    year,
  };
  const includeLabels = options.includeDifferenceLabels ?? false;

  return [
    {
      ...base,
      key: `${row.key}:baseline`,
      view: "Baseline Studio",
      hunterAmount: row.baselineHunter,
      maintenanceAmount: row.baselineMaintenance,
      totalAmount: row.baselineTotal,
      customerHunterTarget: row.registeredCustomerHunterTarget,
      customerMaintenanceTarget: row.registeredCustomerMaintenanceTarget,
      customerStudioHunterTarget: row.registeredCustomerStudioHunterTarget,
      customerStudioMaintenanceTarget: row.registeredCustomerStudioMaintenanceTarget,
      customerStudioTarget: row.registeredCustomerStudioTarget,
      customerTotalTarget: row.registeredCustomerTotalTarget,
      difference: 0,
      hunterDelta: 0,
      maintenanceDelta: 0,
      differenceLabel: includeLabels ? "Valor da planilha fornecida pelo Studio, classificado pelo Tipo Opp." : undefined,
    },
    {
      ...base,
      key: `${row.key}:allocated`,
      view: "Cadastrado",
      hunterAmount: row.allocatedHunter,
      maintenanceAmount: row.allocatedMaintenance,
      totalAmount: row.allocatedTotal,
      customerHunterTarget: row.registeredCustomerHunterTarget,
      customerMaintenanceTarget: row.registeredCustomerMaintenanceTarget,
      customerStudioHunterTarget: row.registeredCustomerStudioHunterTarget,
      customerStudioMaintenanceTarget: row.registeredCustomerStudioMaintenanceTarget,
      customerStudioTarget: row.registeredCustomerStudioTarget,
      customerTotalTarget: row.registeredCustomerTotalTarget,
      difference: normalizeStudioCurrencyDelta(row.allocationDelta),
      hunterDelta: normalizeStudioCurrencyDelta(row.hunterDelta),
      maintenanceDelta: normalizeStudioCurrencyDelta(row.maintenanceDelta),
      differenceLabel: includeLabels ? options.allocatedDifferenceLabel ?? "" : undefined,
    },
    {
      ...base,
      key: `${row.key}:curve`,
      view: "Baseline Curva",
      hunterAmount: row.registeredCustomerStudioHunterTarget,
      maintenanceAmount: row.registeredCustomerStudioMaintenanceTarget,
      totalAmount: row.registeredCustomerStudioTarget,
      customerHunterTarget: row.registeredCustomerHunterTarget,
      customerMaintenanceTarget: row.registeredCustomerMaintenanceTarget,
      customerStudioHunterTarget: row.registeredCustomerStudioHunterTarget,
      customerStudioMaintenanceTarget: row.registeredCustomerStudioMaintenanceTarget,
      customerStudioTarget: row.registeredCustomerStudioTarget,
      customerTotalTarget: row.registeredCustomerTotalTarget,
      difference: normalizeStudioCurrencyDelta(row.allocatedTotal - row.registeredCustomerStudioTarget),
      hunterDelta: 0,
      maintenanceDelta: 0,
      differenceLabel: includeLabels ? "Baseline de Studio da Curva principal do cliente no ano selecionado." : undefined,
    },
  ];
}

export function restoreStudioBaselineComparisonRows(rows: unknown[]): StudioBaselineComparisonRow[] {
  const reportRows = rows.filter(isStudioBaselineReportRow);
  const groups = new Map<string, { baseline?: StudioBaselineReportRow; allocated?: StudioBaselineReportRow; curve?: StudioBaselineReportRow }>();

  reportRows.forEach((row) => {
    const key = `${row.customerName}:${row.studioName}`;
    const group = groups.get(key) ?? {};
    if (row.view === "Baseline" || row.view === "Baseline Studio") group.baseline = row;
    else if (row.view === "Baseline Curva") group.curve = row;
    else group.allocated = row;
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => restoreStudioBaselineGroup(group))
    .filter((row): row is StudioBaselineComparisonRow => Boolean(row))
    .sort((first, second) =>
      first.customerName.localeCompare(second.customerName, "pt-BR")
      || first.studioName.localeCompare(second.studioName, "pt-BR")
    );
}

export function getStudioStatusLabel(status: StudioBaselineComparisonRow["status"]) {
  if (status === "ok") return "OK";
  if (status === "missing_customer") return "Cliente ausente";
  if (status === "missing_studio") return "Studio ausente";
  return "Alocação divergente";
}

function restoreStudioBaselineGroup(group: {
  baseline?: StudioBaselineReportRow;
  allocated?: StudioBaselineReportRow;
  curve?: StudioBaselineReportRow;
}) {
  const baseline = group.baseline;
  const allocated = group.allocated;
  const curve = group.curve;
  const reference = baseline ?? allocated ?? curve;
  if (!reference) return null;

  const baselineHunter = baseline?.hunterAmount ?? 0;
  const baselineMaintenance = baseline?.maintenanceAmount ?? 0;
  const baselineTotal = baseline?.totalAmount ?? 0;
  const allocatedHunter = allocated?.hunterAmount ?? 0;
  const allocatedMaintenance = allocated?.maintenanceAmount ?? 0;
  const allocatedTotal = allocated?.totalAmount ?? 0;
  const curveHunter = curve?.hunterAmount ?? reference.customerStudioHunterTarget ?? 0;
  const curveMaintenance = curve?.maintenanceAmount ?? reference.customerStudioMaintenanceTarget ?? 0;
  const registeredCustomerStudioTarget = curve?.totalAmount ?? reference.customerStudioTarget ?? 0;
  const curveSplitMissing = registeredCustomerStudioTarget > 0.01 && Math.abs(curveHunter + curveMaintenance) <= 0.01;
  const registeredCustomerStudioHunterTarget = curveSplitMissing ? baselineHunter : curveHunter;
  const registeredCustomerStudioMaintenanceTarget = curveSplitMissing ? baselineMaintenance : curveMaintenance;
  const sourceNote = reference.sourceNote ?? "";
  const hunterDelta = normalizeStudioCurrencyDelta(allocated?.hunterDelta ?? roundCurrency(allocatedHunter - baselineHunter));
  const maintenanceDelta = normalizeStudioCurrencyDelta(allocated?.maintenanceDelta ?? roundCurrency(allocatedMaintenance - baselineMaintenance));
  const allocationDelta = normalizeStudioCurrencyDelta(allocated?.difference ?? roundCurrency(allocatedTotal - baselineTotal));
  const status = restoreStudioStatus(reference.status, allocationDelta);

  return {
    key: `${reference.customerName}:${reference.studioName}`,
    customerName: reference.customerName,
    registeredCustomerName: sourceNote.includes("Cliente não cadastrado") ? "" : reference.customerName,
    studioName: reference.studioName,
    registeredStudioName: sourceNote.includes("Studio não cadastrado") ? "" : reference.studioName,
    registeredCustomerHunterTarget: reference.customerHunterTarget ?? 0,
    registeredCustomerMaintenanceTarget: reference.customerMaintenanceTarget ?? 0,
    registeredCustomerStudioHunterTarget,
    registeredCustomerStudioMaintenanceTarget,
    registeredCustomerStudioTarget,
    registeredCustomerTotalTarget: reference.customerTotalTarget ?? 0,
    baselineHunter,
    baselineMaintenance,
    baselineTotal,
    allocatedHunter,
    allocatedMaintenance,
    allocatedTotal,
    hunterDelta,
    maintenanceDelta,
    allocationDelta,
    status,
  } satisfies StudioBaselineComparisonRow;
}

function isStudioBaselineReportRow(row: unknown): row is StudioBaselineReportRow {
  if (!row || typeof row !== "object") return false;
  const item = row as Partial<StudioBaselineReportRow>;
  return typeof item.customerName === "string"
    && typeof item.studioName === "string"
    && (item.view === "Baseline" || item.view === "Baseline Studio" || item.view === "Alocado" || item.view === "Cadastrado" || item.view === "Hunters / Alocações" || item.view === "Baseline Curva")
    && typeof item.hunterAmount === "number"
    && typeof item.maintenanceAmount === "number"
    && typeof item.totalAmount === "number";
}

function restoreStudioStatus(label: string, allocationDelta: number): StudioBaselineComparisonRow["status"] {
  if (label === "OK" || label === "Reconciliado") return "ok";
  if (label === "Cliente ausente") return "missing_customer";
  if (label === "Studio ausente") return "missing_studio";
  if (Math.abs(normalizeStudioCurrencyDelta(allocationDelta)) <= 0.01) return "ok";
  return "allocation_gap";
}
