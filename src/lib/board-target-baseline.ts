import type { Customer } from "@/data/mockData";
import {
  boardTargetBaselineRows,
  boardTargetBaselineSource,
  type BoardTargetBaselineRow,
} from "@/data/boardTargetBaseline";
import { getCustomerTotalTarget } from "@/lib/customer-target-total";
import { normalizeBusinessName } from "@/lib/utils";

export type BaselineComparisonMode = "client" | "hunter" | "combined";

export interface BoardTargetBaselineTotals {
  hunterTarget: number;
  farmerRenewalTarget: number;
  totalTarget: number;
}

export interface BoardTargetComparisonRow {
  key: string;
  customerName: string;
  registeredCustomerName: string;
  businessUnit: string;
  baselineHunterTarget: number;
  baselineFarmerRenewalTarget: number;
  baselineTotalTarget: number;
  registeredHunterTarget: number;
  registeredFarmerRenewalTarget: number;
  registeredStudioMaintenanceTarget: number;
  registeredTotalTarget: number;
  hunterDelta: number;
  farmerRenewalDelta: number;
  totalDelta: number;
  status: "ok" | "above" | "below" | "missing_customer" | "extra_customer";
}

export function getBoardTargetBaselineRows(
  year = boardTargetBaselineSource.year,
  rows: BoardTargetBaselineRow[] = boardTargetBaselineRows,
) {
  return rows.filter((row) => row.year === year);
}

export function getBoardTargetBaselineTotals(
  year = boardTargetBaselineSource.year,
  rows: BoardTargetBaselineRow[] = boardTargetBaselineRows,
): BoardTargetBaselineTotals {
  return getBoardTargetBaselineRows(year, rows).reduce((totals, row) => ({
    hunterTarget: roundCurrency(totals.hunterTarget + row.hunterTarget),
    farmerRenewalTarget: roundCurrency(totals.farmerRenewalTarget + row.farmerRenewalTarget),
    totalTarget: roundCurrency(totals.totalTarget + row.totalTarget),
  }), { hunterTarget: 0, farmerRenewalTarget: 0, totalTarget: 0 });
}

export function getRegisteredTargetTotals(customers: Customer[]): BoardTargetBaselineTotals {
  return customers.reduce((totals, customer) => ({
    hunterTarget: roundCurrency(totals.hunterTarget + customer.hunterTarget),
    farmerRenewalTarget: roundCurrency(totals.farmerRenewalTarget + customer.farmerRenewalTarget),
    totalTarget: roundCurrency(totals.totalTarget + getRegisteredCustomerTarget(customer)),
  }), { hunterTarget: 0, farmerRenewalTarget: 0, totalTarget: 0 });
}

export function buildBoardTargetComparisonRows(
  customers: Customer[],
  year = boardTargetBaselineSource.year,
  rows: BoardTargetBaselineRow[] = boardTargetBaselineRows,
): BoardTargetComparisonRow[] {
  const customersByName = new Map(customers.map((customer) => [normalizeBusinessName(customer.name), customer]));
  const baselineRows = getBoardTargetBaselineRows(year, rows);
  const matchedCustomerIds = new Set<string>();

  const baselineComparisons = baselineRows.map((baselineRow) => {
    const customer = customersByName.get(normalizeBusinessName(baselineRow.customerName));
    if (customer) matchedCustomerIds.add(customer.id);
    return buildComparisonRow(baselineRow, customer);
  });

  const extraCustomerComparisons = customers
    .filter((customer) => !matchedCustomerIds.has(customer.id) && getRegisteredCustomerTarget(customer) > 0)
    .map((customer) => buildComparisonRow(undefined, customer));

  return [...baselineComparisons, ...extraCustomerComparisons]
    .sort((first, second) => Math.abs(second.totalDelta) - Math.abs(first.totalDelta) || first.customerName.localeCompare(second.customerName, "pt-BR"));
}

export function getBoardComparisonStatusLabel(status: BoardTargetComparisonRow["status"]) {
  if (status === "ok") return "OK";
  if (status === "above") return "Acima do baseline";
  if (status === "below") return "Abaixo do baseline";
  if (status === "missing_customer") return "Cliente não cadastrado";
  return "Cliente / receita nova";
}

function buildComparisonRow(
  baselineRow: BoardTargetBaselineRow | undefined,
  customer: Customer | undefined,
): BoardTargetComparisonRow {
  const baselineHunterTarget = baselineRow?.hunterTarget ?? 0;
  const baselineFarmerRenewalTarget = baselineRow?.farmerRenewalTarget ?? 0;
  const baselineTotalTarget = baselineRow?.totalTarget ?? 0;
  const registeredHunterTarget = customer?.hunterTarget ?? 0;
  const registeredFarmerRenewalTarget = customer?.farmerRenewalTarget ?? 0;
  const registeredStudioMaintenanceTarget = customer?.studioTarget ?? 0;
  const registeredTotalTarget = customer ? getRegisteredCustomerTarget(customer) : 0;
  const totalDelta = roundCurrency(registeredTotalTarget - baselineTotalTarget);
  const status = getComparisonStatus(Boolean(baselineRow), Boolean(customer), totalDelta);

  return {
    key: baselineRow?.customerName ?? customer?.id ?? "unknown",
    customerName: baselineRow?.customerName ?? customer?.name ?? "Cliente não identificado",
    registeredCustomerName: customer?.name ?? "",
    businessUnit: baselineRow?.businessUnit ?? "Cadastro",
    baselineHunterTarget,
    baselineFarmerRenewalTarget,
    baselineTotalTarget,
    registeredHunterTarget,
    registeredFarmerRenewalTarget,
    registeredStudioMaintenanceTarget,
    registeredTotalTarget,
    hunterDelta: roundCurrency(registeredHunterTarget - baselineHunterTarget),
    farmerRenewalDelta: roundCurrency(registeredFarmerRenewalTarget - baselineFarmerRenewalTarget),
    totalDelta,
    status,
  };
}

function getComparisonStatus(hasBaseline: boolean, hasCustomer: boolean, totalDelta: number): BoardTargetComparisonRow["status"] {
  if (!hasCustomer) return "missing_customer";
  if (!hasBaseline) return "extra_customer";
  if (Math.abs(Math.round(totalDelta)) <= 0) return "ok";
  return totalDelta > 0 ? "above" : "below";
}

function getRegisteredCustomerTarget(customer: Customer) {
  return getCustomerTotalTarget(customer);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
