import { strFromU8, unzipSync } from "fflate";
import type { Area, Customer, StudioTargetAllocation } from "@/data/mockData";
import { normalizeBusinessName } from "@/lib/utils";

export interface StudioBaselineRow {
  rowNumber: number;
  salesUnit: string;
  tower: string;
  customerName: string;
  studioName: string;
  opportunityType: string;
  hunterAmount: number;
  maintenanceAmount: number;
  totalAmount: number;
}

export interface StudioBaselineComparisonRow {
  key: string;
  customerName: string;
  registeredCustomerName: string;
  studioName: string;
  registeredStudioName: string;
  baselineHunter: number;
  baselineMaintenance: number;
  baselineTotal: number;
  allocatedHunter: number;
  allocatedMaintenance: number;
  allocatedTotal: number;
  allocationDelta: number;
  status: "ok" | "allocation_gap" | "missing_customer" | "missing_studio";
}

export interface StudioBaselineSnapshot {
  id: string;
  year: number;
  fileName: string;
  rows: unknown[];
  totals: Record<string, number>;
  createdAt: string;
}

const studioBaselineHeaders = {
  salesUnit: ["su"],
  tower: ["torre"],
  customerName: ["grupo cliente", "cliente"],
  studioName: ["studio/habilitador", "studio", "habilitador"],
  opportunityType: ["tipo opp", "tipo oportunidade", "tipo"],
  netRevenue: ["receita liquida", "receita líquida", "rl"],
};

export async function readStudioBaselineWorkbook(file: File): Promise<StudioBaselineRow[]> {
  const rows = readWorkbookRows(await file.arrayBuffer());
  return parseStudioBaselineRows(rows);
}

export function parseStudioBaselineRows(rows: unknown[][]): StudioBaselineRow[] {
  if (!rows.length) throw new Error("A planilha de baseline de studios está vazia.");

  const headers = rows[0].map((cell) => normalizeHeader(String(cell ?? "")));
  const indexes = {
    salesUnit: findHeaderIndex(headers, studioBaselineHeaders.salesUnit, "SU"),
    tower: findHeaderIndex(headers, studioBaselineHeaders.tower, "Torre"),
    customerName: findHeaderIndex(headers, studioBaselineHeaders.customerName, "Grupo Cliente"),
    studioName: findHeaderIndex(headers, studioBaselineHeaders.studioName, "Studio/Habilitador"),
    opportunityType: findHeaderIndex(headers, studioBaselineHeaders.opportunityType, "Tipo Opp"),
    netRevenue: findHeaderIndex(headers, studioBaselineHeaders.netRevenue, "Receita Líquida"),
  };

  const grouped = new Map<string, StudioBaselineRow>();
  rows.slice(1).forEach((row, index) => {
    const customerName = String(row[indexes.customerName] ?? "").trim();
    const studioName = String(row[indexes.studioName] ?? "").trim();
    const opportunityType = String(row[indexes.opportunityType] ?? "").trim();
    const amount = parseAmount(row[indexes.netRevenue]);
    if (!customerName || !studioName || amount <= 0) return;

    const key = `${normalizeBusinessName(customerName)}:${normalizeBusinessName(studioName)}`;
    const current = grouped.get(key) ?? {
      rowNumber: index + 2,
      salesUnit: String(row[indexes.salesUnit] ?? "").trim(),
      tower: String(row[indexes.tower] ?? "").trim(),
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

export function buildStudioBaselineComparisons(
  baselineRows: StudioBaselineRow[],
  customers: Customer[],
  areas: Area[],
  studioAllocations: StudioTargetAllocation[],
  year: number,
): StudioBaselineComparisonRow[] {
  const customersByName = new Map(customers.map((customer) => [normalizeBusinessName(customer.name), customer]));
  const areasByName = new Map(areas.map((area) => [normalizeBusinessName(area.name), area]));

  return baselineRows.map((row) => {
    const customerKey = normalizeBusinessName(row.customerName);
    const customer = customersByName.get(customerKey);
    const area = areasByName.get(normalizeBusinessName(row.studioName));
    const customerAllocations = customer && area
      ? studioAllocations.filter((allocation) =>
        allocation.customerId === customer.id
        && allocation.areaId === area.id
        && allocation.year === year
      )
      : [];
    const allocatedHunter = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.hunterAmount, 0));
    const allocatedMaintenance = roundCurrency(customerAllocations.reduce((total, allocation) => total + allocation.maintenanceAmount, 0));
    const allocatedTotal = roundCurrency(allocatedHunter + allocatedMaintenance);
    const allocationDelta = roundCurrency(allocatedTotal - row.totalAmount);

    return {
      key: `${row.customerName}:${row.studioName}`,
      customerName: row.customerName,
      registeredCustomerName: customer?.name ?? "",
      studioName: row.studioName,
      registeredStudioName: area?.name ?? "",
      baselineHunter: row.hunterAmount,
      baselineMaintenance: row.maintenanceAmount,
      baselineTotal: row.totalAmount,
      allocatedHunter,
      allocatedMaintenance,
      allocatedTotal,
      allocationDelta,
      status: getStudioComparisonStatus(Boolean(customer), Boolean(area), allocationDelta),
    };
  });
}

function readWorkbookRows(buffer: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const sheetEntry = files["xl/worksheets/sheet1.xml"];
  if (!sheetEntry) throw new Error("Não foi possível localizar a primeira aba da planilha.");
  const sharedStrings = readSharedStrings(files["xl/sharedStrings.xml"]);
  const xml = new DOMParser().parseFromString(strFromU8(sheetEntry), "application/xml");
  const rowNodes = Array.from(xml.getElementsByTagName("row"));

  return rowNodes.map((rowNode) => {
    const row: unknown[] = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach((cellNode) => {
      const reference = cellNode.getAttribute("r") ?? "";
      const columnIndex = getColumnIndex(reference.replace(/\d/g, ""));
      row[columnIndex] = readCellValue(cellNode, sharedStrings);
    });
    return row;
  });
}

function readSharedStrings(entry?: Uint8Array) {
  if (!entry) return [];
  const xml = new DOMParser().parseFromString(strFromU8(entry), "application/xml");
  return Array.from(xml.getElementsByTagName("si")).map((item) => item.textContent ?? "");
}

function readCellValue(cellNode: Element, sharedStrings: string[]) {
  const type = cellNode.getAttribute("t");
  if (type === "inlineStr") return cellNode.getElementsByTagName("is")[0]?.textContent ?? "";
  const rawValue = cellNode.getElementsByTagName("v")[0]?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(rawValue)] ?? "";
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) && rawValue !== "" ? numericValue : rawValue;
}

function getColumnIndex(columnRef: string) {
  return columnRef.split("").reduce((total, letter) => total * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0) - 1;
}

function findHeaderIndex(headers: string[], aliases: string[], label: string) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedAliases.includes(header));
  if (index >= 0) return index;
  throw new Error(`Coluna obrigatória não encontrada na planilha de studios: ${label}.`);
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseAmount(value: unknown) {
  if (typeof value === "number") return roundCurrency(value);
  const normalized = String(value ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized || 0);
  return Number.isFinite(amount) && amount > 0 ? roundCurrency(amount) : 0;
}

function isStudioHunterOpportunity(value: string) {
  const normalized = normalizeHeader(value);
  return normalized.includes("novo") || normalized.includes("ampliacao");
}

function getStudioComparisonStatus(
  hasCustomer: boolean,
  hasStudio: boolean,
  allocationDelta: number,
): StudioBaselineComparisonRow["status"] {
  if (!hasCustomer) return "missing_customer";
  if (!hasStudio) return "missing_studio";
  if (Math.abs(allocationDelta) > 0.01) return "allocation_gap";
  return "ok";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
