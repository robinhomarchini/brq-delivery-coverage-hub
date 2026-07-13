import { strFromU8, unzipSync } from "fflate";
import type { Area, Customer, StudioTargetAllocation } from "@/data/mockData";
import { normalizeBusinessName, roundCurrency } from "@/lib/utils";

export interface StudioBaselineRow {
  rowNumber: number;
  salesUnit: string;
  tower: string;
  businessUnit?: string;
  customerName: string;
  studioName: string;
  opportunityType: string;
  hunterAmount: number;
  maintenanceAmount: number;
  totalAmount: number;
}

export type StudioBaselineSourceCode = "studio_general" | "studio_px" | "studio_aliancas" | "studio_mobile" | "studio_analytics" | "studio_genai";

export interface StudioBaselineSource {
  code: StudioBaselineSourceCode;
  name: string;
  defaultStudioName?: string;
  supportedLayouts: StudioBaselineLayout[];
}

type StudioBaselineLayout = "detailed-studio" | "wide-customer-values";

export interface StudioBaselineComparisonRow {
  key: string;
  customerName: string;
  registeredCustomerName: string;
  studioName: string;
  registeredStudioName: string;
  registeredCustomerHunterTarget: number;
  registeredCustomerMaintenanceTarget: number;
  registeredCustomerStudioTarget: number;
  registeredCustomerTotalTarget: number;
  baselineHunter: number;
  baselineMaintenance: number;
  baselineTotal: number;
  allocatedHunter: number;
  allocatedMaintenance: number;
  allocatedTotal: number;
  hunterDelta: number;
  maintenanceDelta: number;
  allocationDelta: number;
  status: "ok" | "allocation_gap" | "missing_customer" | "missing_studio";
}

export interface StudioBaselineSnapshot {
  id: string;
  year: number;
  sourceCode: StudioBaselineSourceCode;
  sourceName: string;
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
  businessUnit: ["cc cross", "bu", "business unit"],
};

const wideStudioBaselineHeaders = {
  customerName: ["cliente", "grupo cliente", "customer"],
  maintenanceAmount: ["renovacao / manut", "renovação / manut", "renovacao manut", "renovação manut", "renovacao", "renovação", "manutencao", "manutenção"],
  hunterAmount: ["novos projetos / hunter", "novos projetos hunter", "novo / hunter", "novo hunter", "hunter"],
};

export const studioBaselineSources: StudioBaselineSource[] = [
  { code: "studio_general", name: "Baseline geral de Studios", supportedLayouts: ["detailed-studio"] },
  { code: "studio_px", name: "Studio PX", defaultStudioName: "PX", supportedLayouts: ["wide-customer-values", "detailed-studio"] },
  { code: "studio_aliancas", name: "Alianças", defaultStudioName: "Alianças", supportedLayouts: ["wide-customer-values", "detailed-studio"] },
  { code: "studio_mobile", name: "Mobile", defaultStudioName: "Mobile", supportedLayouts: ["wide-customer-values", "detailed-studio"] },
  { code: "studio_analytics", name: "Analytics", defaultStudioName: "Analytics", supportedLayouts: ["wide-customer-values", "detailed-studio"] },
  { code: "studio_genai", name: "GENAI", defaultStudioName: "GENAI", supportedLayouts: ["wide-customer-values", "detailed-studio"] },
];

export function getStudioBaselineSource(code: string): StudioBaselineSource {
  return studioBaselineSources.find((source) => source.code === code) ?? studioBaselineSources[0];
}

export async function readStudioBaselineWorkbook(file: File, source: StudioBaselineSource = studioBaselineSources[0]): Promise<StudioBaselineRow[]> {
  const rows = readWorkbookRows(await file.arrayBuffer());
  return parseStudioBaselineRows(rows, source);
}

export function parseStudioBaselineRows(rows: unknown[][], source: StudioBaselineSource = studioBaselineSources[0]): StudioBaselineRow[] {
  if (!rows.length) throw new Error("A planilha de baseline de studios está vazia.");
  if (source.supportedLayouts.includes("wide-customer-values")) {
    const wideRows = tryParseWideStudioBaselineRows(rows, source);
    if (wideRows) return wideRows;
  }
  if (!source.supportedLayouts.includes("detailed-studio")) {
    throw new Error(`Layout da origem ${source.name} ainda não está cadastrado. Inclua as colunas Cliente, Renovação/Manut e Novos Projetos/Hunter ou cadastre o layout específico desta origem.`);
  }

  const headers = rows[0].map((cell) => normalizeHeader(String(cell ?? "")));
  const indexes = {
    salesUnit: findHeaderIndex(headers, studioBaselineHeaders.salesUnit, "SU"),
    tower: findHeaderIndex(headers, studioBaselineHeaders.tower, "Torre"),
    customerName: findHeaderIndex(headers, studioBaselineHeaders.customerName, "Grupo Cliente"),
    studioName: findHeaderIndex(headers, studioBaselineHeaders.studioName, "Studio/Habilitador"),
    opportunityType: findHeaderIndex(headers, studioBaselineHeaders.opportunityType, "Tipo Opp"),
    netRevenue: findHeaderIndex(headers, studioBaselineHeaders.netRevenue, "Receita Líquida"),
    businessUnit: findOptionalHeaderIndex(headers, studioBaselineHeaders.businessUnit),
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
      businessUnit: indexes.businessUnit >= 0 ? String(row[indexes.businessUnit] ?? "").trim() : undefined,
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

function tryParseWideStudioBaselineRows(rows: unknown[][], source: StudioBaselineSource): StudioBaselineRow[] | null {
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => normalizeHeader(String(cell ?? "")));
    return findOptionalHeaderIndex(headers, wideStudioBaselineHeaders.maintenanceAmount) >= 0
      && findOptionalHeaderIndex(headers, wideStudioBaselineHeaders.hunterAmount) >= 0;
  });
  if (headerRowIndex < 0) return null;

  const headerRow = rows[headerRowIndex].map((cell) => normalizeHeader(String(cell ?? "")));
  const maintenanceIndex = findOptionalHeaderIndex(headerRow, wideStudioBaselineHeaders.maintenanceAmount);
  const hunterIndex = findOptionalHeaderIndex(headerRow, wideStudioBaselineHeaders.hunterAmount);
  const explicitCustomerIndex = findOptionalHeaderIndex(headerRow, wideStudioBaselineHeaders.customerName);
  const customerIndex = explicitCustomerIndex >= 0 ? explicitCustomerIndex : findWideCustomerColumnIndex(rows, headerRowIndex, maintenanceIndex, hunterIndex);
  if (customerIndex < 0) throw new Error("Coluna de Cliente não encontrada na planilha de baseline.");

  const grouped = new Map<string, StudioBaselineRow>();
  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    const customerName = String(row[customerIndex] ?? "").trim();
    if (!customerName || isWideGroupRow(customerName)) return;

    const maintenanceAmount = parseAmount(row[maintenanceIndex]);
    const hunterAmount = parseAmount(row[hunterIndex]);
    if (maintenanceAmount <= 0 && hunterAmount <= 0) return;

    const studioName = source.defaultStudioName ?? source.name;
    const key = `${normalizeBusinessName(customerName)}:${normalizeBusinessName(studioName)}`;
    const current = grouped.get(key) ?? {
      rowNumber: headerRowIndex + offset + 2,
      salesUnit: source.name,
      tower: source.name,
      businessUnit: undefined,
      customerName,
      studioName,
      opportunityType: "Baseline centralizado",
      hunterAmount: 0,
      maintenanceAmount: 0,
      totalAmount: 0,
    };

    current.hunterAmount = roundCurrency(current.hunterAmount + hunterAmount);
    current.maintenanceAmount = roundCurrency(current.maintenanceAmount + maintenanceAmount);
    current.totalAmount = roundCurrency(current.hunterAmount + current.maintenanceAmount);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).sort((first, second) =>
    first.customerName.localeCompare(second.customerName, "pt-BR")
    || first.studioName.localeCompare(second.studioName, "pt-BR")
  );
}

export function isFinancialStudioBaselineRow(row: StudioBaselineRow) {
  return !row.businessUnit || normalizeBusinessName(row.businessUnit) === "bu financial";
}

function findWideCustomerColumnIndex(rows: unknown[][], headerRowIndex: number, maintenanceIndex: number, hunterIndex: number) {
  const maxIndex = Math.max(maintenanceIndex, hunterIndex);
  const candidates = Array.from({ length: maxIndex }, (_, index) => index);
  return candidates.find((candidate) =>
    rows.slice(headerRowIndex + 1, headerRowIndex + 12).some((row) => {
      const label = String(row[candidate] ?? "").trim();
      return label && !isWideGroupRow(label) && (parseAmount(row[maintenanceIndex]) > 0 || parseAmount(row[hunterIndex]) > 0);
    })
  ) ?? -1;
}

function isWideGroupRow(value: string) {
  return normalizeHeader(value).startsWith("grupo ");
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
    const hunterDelta = roundCurrency(allocatedHunter - row.hunterAmount);
    const maintenanceDelta = roundCurrency(allocatedMaintenance - row.maintenanceAmount);
    const allocationDelta = roundCurrency(allocatedTotal - row.totalAmount);
    const registeredCustomerHunterTarget = customer ? roundCurrency(customer.hunterTarget) : 0;
    const registeredCustomerMaintenanceTarget = customer ? roundCurrency(customer.farmerRenewalTarget) : 0;
    const registeredCustomerStudioTarget = customer ? roundCurrency(customer.studioTarget) : 0;
    const registeredCustomerTotalTarget = customer ? roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget + customer.studioTarget) : 0;

    return {
      key: `${row.customerName}:${row.studioName}`,
      customerName: row.customerName,
      registeredCustomerName: customer?.name ?? "",
      studioName: row.studioName,
      registeredStudioName: area?.name ?? "",
      registeredCustomerHunterTarget,
      registeredCustomerMaintenanceTarget,
      registeredCustomerStudioTarget,
      registeredCustomerTotalTarget,
      baselineHunter: row.hunterAmount,
      baselineMaintenance: row.maintenanceAmount,
      baselineTotal: row.totalAmount,
      allocatedHunter,
      allocatedMaintenance,
      allocatedTotal,
      hunterDelta,
      maintenanceDelta,
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

function findOptionalHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(header));
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

export function isStudioHunterOpportunity(value: string) {
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
