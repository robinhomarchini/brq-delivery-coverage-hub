import type { Customer, Person, StudioTargetAllocation, TargetAllocation } from "@/data/mockData";
import { isHunterRole } from "@/lib/roles";
import { getContainedHunterAllocation } from "@/lib/customer-hunter-reconciliation";

export type SpreadsheetCell = unknown;

export interface TargetBaselineRow {
  rowNumber: number;
  customerName: string;
  businessUnit: string;
  hunterTarget: number;
  farmerRenewalTarget: number;
  studioTarget: number;
  totalTarget: number;
  responsibleCode: string;
}

export interface TargetBaselineComparison {
  key: string;
  row: TargetBaselineRow;
  effectiveHunterTarget: number;
  effectiveFarmerRenewalTarget: number;
  effectiveStudioTarget: number;
  effectiveRevenue: number;
  customer?: Customer;
  matchedCustomerName?: string;
  updateCandidate?: Customer;
  valueStatus: "ok" | "different" | "missing_customer" | "invalid_total";
  hunterStatus: "ok" | "warning" | "not_applicable";
  hunterMessage: string;
  differences: TargetBaselineDifference[];
  sheetTotalDifference: number;
}

export interface TargetBaselineDifference {
  field: "hunterTarget" | "farmerRenewalTarget" | "studioTarget" | "revenue";
  label: string;
  currentValue: number;
  importedValue: number;
  delta: number;
}

const requiredHeaders = {
  customerName: ["cliente", "customer", "nome do cliente"],
  businessUnit: ["bu", "business unit"],
  hunterTarget: ["target rl hunter", "meta hunter", "hunter", "od novo", "od - novo"],
  farmerRenewalTarget: ["target rl farmer", "meta farmer", "renovacao", "renovação", "renovacao ampliacao", "renovação ampliação", "od renovacao ampliacao", "od renovação ampliação", "od - renovacao ampliacao", "od - renovação ampliação", "od - renovacao & ampliacao", "od - renovação & ampliação"],
  totalTarget: ["total rl 2026", "meta total", "total"],
};

const optionalHeaders = {
  responsibleCode: ["resp", "responsavel", "responsável", "hunter responsavel", "hunter responsável"],
  studioTarget: [
    "target rl areas",
    "target rl areas studios",
    "target rl studios",
    "meta areas",
    "meta áreas",
    "meta areas studios",
    "meta áreas studios",
    "areas",
    "áreas",
    "areas studios",
    "áreas studios",
    "areas / studios",
    "áreas / studios",
    "studio",
    "studios",
  ],
};

const responsibleAliases: Record<string, string[]> = {
  edu: ["Eduardo Alves Leite", "Eduardo"],
  gabi: ["Gabriela Macedo", "Gabriela"],
  bete: ["Beth", "Bete"],
  beth: ["Beth", "Bete"],
  bonatti: ["Ricardo Bonatti", "Bonatti"],
  saugo: ["Marcelo Saugo", "Saugo"],
  paula: ["Paula"],
  ca: ["CA"],
};

const zeroMoneyTolerance = 0.01;

export function parseTargetBaselineRows(rows: SpreadsheetCell[][]): TargetBaselineRow[] {
  if (!rows.length) throw new Error("A planilha está vazia.");

  const headerRowIndex = findTargetHeaderRowIndex(rows);
  const headers = rows[headerRowIndex].map((cell) => normalizeHeader(String(cell ?? "")));
  const indexes = {
    customerName: findHeaderIndex(headers, requiredHeaders.customerName, "Cliente"),
    businessUnit: findHeaderIndex(headers, requiredHeaders.businessUnit, "BU"),
    hunterTarget: findHeaderIndex(headers, requiredHeaders.hunterTarget, "Target RL Hunter"),
    farmerRenewalTarget: findHeaderIndex(headers, requiredHeaders.farmerRenewalTarget, "Target RL Farmer"),
    studioTarget: findOptionalHeaderIndex(headers, optionalHeaders.studioTarget),
    totalTarget: findHeaderIndex(headers, requiredHeaders.totalTarget, "Total RL 2026"),
    responsibleCode: findOptionalHeaderIndex(headers, optionalHeaders.responsibleCode),
  };

  return rows.slice(headerRowIndex + 1)
    .map((row, index) => {
      const hunterTarget = parseMoney(row[indexes.hunterTarget]);
      const farmerRenewalTarget = parseMoney(row[indexes.farmerRenewalTarget]);
      const parsedTotalTarget = parseMoney(row[indexes.totalTarget]);
      const totalTarget = parsedTotalTarget > 0
        ? parsedTotalTarget
        : roundCurrency(hunterTarget + farmerRenewalTarget);
      const studioTarget = indexes.studioTarget >= 0
        ? parseMoney(row[indexes.studioTarget])
        : Math.max(roundCurrency(totalTarget - hunterTarget - farmerRenewalTarget), 0);

      return {
        rowNumber: headerRowIndex + index + 2,
        customerName: String(row[indexes.customerName] ?? "").trim(),
        businessUnit: String(row[indexes.businessUnit] ?? "").trim(),
        hunterTarget,
        farmerRenewalTarget,
        studioTarget,
        totalTarget,
        responsibleCode: indexes.responsibleCode >= 0 ? String(row[indexes.responsibleCode] ?? "").trim() : "",
      };
    })
    .filter((row) => row.customerName);
}

function findTargetHeaderRowIndex(rows: SpreadsheetCell[][]) {
  const index = rows.findIndex((row) => {
    const headers = row.map((cell) => normalizeHeader(String(cell ?? "")));
    return findOptionalHeaderIndex(headers, requiredHeaders.customerName) >= 0
      && findOptionalHeaderIndex(headers, requiredHeaders.businessUnit) >= 0
      && findOptionalHeaderIndex(headers, requiredHeaders.hunterTarget) >= 0
      && findOptionalHeaderIndex(headers, requiredHeaders.farmerRenewalTarget) >= 0
      && findOptionalHeaderIndex(headers, requiredHeaders.totalTarget) >= 0;
  });
  if (index >= 0) return index;
  throw new Error("Cabeçalho da baseline não encontrado. Verifique Cliente, BU, Hunter/Renovação e Total RL 2026.");
}

export function buildTargetBaselineComparisons(
  baselineRows: TargetBaselineRow[],
  customers: Customer[],
  people: Person[],
  targetAllocations: TargetAllocation[],
  studioTargetAllocations: StudioTargetAllocation[],
  year: number,
): TargetBaselineComparison[] {
  const customersByName = new Map(customers.map((customer) => [normalizeName(customer.name), customer]));

  return baselineRows.map((row) => {
    const customer = customersByName.get(normalizeName(row.customerName));
    const importedHunter = roundCurrency(row.hunterTarget);
    const importedFarmerRenewal = roundCurrency(row.farmerRenewalTarget);
    const importedStudio = roundCurrency(row.studioTarget);
    const importedRevenue = roundCurrency(importedHunter + importedFarmerRenewal + importedStudio);
    const sheetTotalDifference = roundCurrency(row.totalTarget - importedRevenue);

    if (!customer) {
      return {
        key: `${row.rowNumber}-${row.customerName}`,
        row,
        effectiveHunterTarget: importedHunter,
        effectiveFarmerRenewalTarget: importedFarmerRenewal,
        effectiveStudioTarget: importedStudio,
        effectiveRevenue: importedRevenue,
        valueStatus: "missing_customer",
        hunterStatus: "warning",
        hunterMessage: "Cliente não encontrado na base.",
        differences: [],
        sheetTotalDifference,
      };
    }

    const differences = buildDifferences(customer, importedHunter, importedFarmerRenewal, importedStudio, importedRevenue);
    const importedTotalIsValid = isSameDisplayedCurrency(row.totalTarget, importedRevenue);
    const hunterCheck = validateHunterConsistency(row, customer, people, targetAllocations, studioTargetAllocations, year);

    return {
      key: customer.id,
      row,
      effectiveHunterTarget: importedHunter,
      effectiveFarmerRenewalTarget: importedFarmerRenewal,
      effectiveStudioTarget: importedStudio,
      effectiveRevenue: importedRevenue,
      customer,
      matchedCustomerName: customer.name,
      updateCandidate: {
        ...customer,
        hunterTarget: importedHunter,
        farmerRenewalTarget: importedFarmerRenewal,
        studioTarget: importedStudio,
        revenue: importedRevenue,
      },
      valueStatus: !importedTotalIsValid ? "invalid_total" : differences.length ? "different" : "ok",
      hunterStatus: hunterCheck.status,
      hunterMessage: hunterCheck.message,
      differences,
      sheetTotalDifference,
    };
  });
}

export function getResponsibleDisplayName(code: string, people: Person[]) {
  const person = findResponsiblePerson(code, people);
  if (person) return person.name;
  return code ? `${code} não identificado` : "Sem responsável definido";
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function buildDifferences(customer: Customer, hunterTarget: number, farmerRenewalTarget: number, studioTarget: number, revenue: number) {
  const currentRevenue = getCustomerTarget(customer);
  const candidates: TargetBaselineDifference[] = [
    {
      field: "hunterTarget",
      label: "Meta Hunter",
      currentValue: customer.hunterTarget,
      importedValue: hunterTarget,
      delta: hunterTarget - customer.hunterTarget,
    },
    {
      field: "farmerRenewalTarget",
      label: "Renovação + Ampliação",
      currentValue: customer.farmerRenewalTarget,
      importedValue: farmerRenewalTarget,
      delta: farmerRenewalTarget - customer.farmerRenewalTarget,
    },
    {
      field: "studioTarget",
      label: "Áreas / Studios",
      currentValue: customer.studioTarget,
      importedValue: studioTarget,
      delta: studioTarget - customer.studioTarget,
    },
    {
      field: "revenue",
      label: "Meta Total",
      currentValue: currentRevenue,
      importedValue: revenue,
      delta: revenue - currentRevenue,
    },
  ];
  return candidates.filter((difference) => !isSameDisplayedCurrency(difference.currentValue, difference.importedValue));
}

function validateHunterConsistency(
  row: TargetBaselineRow,
  customer: Customer,
  people: Person[],
  targetAllocations: TargetAllocation[],
  studioTargetAllocations: StudioTargetAllocation[],
  year: number,
) {
  const importedHunter = roundCurrency(row.hunterTarget);
  const importedFarmerRenewal = roundCurrency(row.farmerRenewalTarget);
  const importedStudio = roundCurrency(row.studioTarget);
  const responsiblePerson = findResponsiblePerson(row.responsibleCode, people);
  const directHunterAllocations = targetAllocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.type === "hunter" && allocation.amount > zeroMoneyTolerance)
    .map<HunterContribution>((allocation) => ({
      amount: allocation.amount,
      source: "Meta Hunter",
      person: people.find((person) => person.id === allocation.personId),
    }));
  const studioHunterAllocations = studioTargetAllocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.hunterAmount > zeroMoneyTolerance)
    .map<HunterContribution>((allocation) => ({
      amount: allocation.hunterAmount,
      source: "Studio Hunter",
      person: allocation.hunterPersonId
        ? people.find((person) => person.id === allocation.hunterPersonId)
        : undefined,
    }));
  const hunterAllocations = [...directHunterAllocations, ...studioHunterAllocations];
  const allocatedHunterTotal = getContainedHunterAllocation({
    customerId: customer.id,
    year,
    targetAllocations,
    studioTargetAllocations,
  }).containedHunter;
  const allocationBreakdown = formatHunterAllocationBreakdown(hunterAllocations);

  if (importedHunter <= zeroMoneyTolerance) {
    if (allocatedHunterTotal > zeroMoneyTolerance) {
      const allocationMessage = `${allocationBreakdown} totalizando ${formatCurrency(allocatedHunterTotal)}`;
      const nonHunterImportedTotal = roundCurrency(importedFarmerRenewal + importedStudio);
      if (nonHunterImportedTotal > zeroMoneyTolerance) {
        return {
          status: "warning" as const,
          message: `Planilha classifica ${formatCurrency(nonHunterImportedTotal)} fora de Hunter, mas o sistema está com Hunter alocado para ${allocationMessage}. Corrija Metas por Pessoa ou aplique a planilha como baseline.`,
        };
      }
      return {
        status: "warning" as const,
        message: `Planilha sem meta Hunter, mas o sistema está com Hunter alocado para ${allocationMessage}.`,
      };
    }
    return { status: "not_applicable" as const, message: "Sem meta Hunter na planilha." };
  }

  if (!hunterAllocations.length) {
    return {
      status: "warning" as const,
      message: row.responsibleCode
        ? `Planilha informa ${formatCurrency(importedHunter)} de Hunter para ${row.responsibleCode}, mas não há meta Hunter alocada no sistema para este cliente/ano.`
        : `Planilha informa ${formatCurrency(importedHunter)} de Hunter, mas não há meta Hunter alocada no sistema para este cliente/ano.`,
    };
  }

  if (!isSameDisplayedCurrency(allocatedHunterTotal, importedHunter)) {
    return {
      status: "warning" as const,
      message: `Valor Hunter divergente: planilha ${formatCurrency(importedHunter)} vs. sistema ${formatCurrency(allocatedHunterTotal)}. Composição no sistema: ${allocationBreakdown}. Studio Hunter é tratado como contido por pessoa, sem duplicar Meta Hunter direta.`,
    };
  }

  if (!responsiblePerson) {
    return {
      status: "ok" as const,
      message: row.responsibleCode
        ? `Valor Hunter consistente no total. Responsável "${row.responsibleCode}" não foi encontrado, mas o sistema soma ${formatCurrency(allocatedHunterTotal)} em: ${allocationBreakdown}.`
        : `Valor Hunter consistente no total: ${allocationBreakdown}.`,
    };
  }

  const hasResponsibleAllocation = hunterAllocations.some((item) => item.person?.id === responsiblePerson.id);
  if (!hasResponsibleAllocation) {
    return {
      status: "warning" as const,
      message: `Valor Hunter consistente no total, mas a planilha indica ${responsiblePerson.name} e o sistema tem composição em: ${allocationBreakdown}.`,
    };
  }

  const responsibleHasHunterProfile = isHunterRole(responsiblePerson.roleType);
  if (!responsibleHasHunterProfile) {
    return {
      status: "ok" as const,
      message: `Valor Hunter consistente no total. ${responsiblePerson.name} possui meta Hunter alocada, embora o perfil cadastral seja ${responsiblePerson.roleType}. Composição: ${allocationBreakdown}.`,
    };
  }

  return { status: "ok" as const, message: `Valor Hunter consistente no total: ${allocationBreakdown}.` };
}

function findResponsiblePerson(code: string, people: Person[]) {
  const aliases = responsibleAliases[normalizeCode(code)] ?? [code];
  const normalizedAliases = aliases.map(normalizeName);
  return people.find((person) => normalizedAliases.includes(normalizeName(person.name)));
}

function findHeaderIndex(headers: string[], aliases: string[], label: string) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedAliases.includes(header));
  if (index >= 0) return index;
  throw new Error(`Coluna obrigatória não encontrada: ${label}.`);
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

function normalizeCode(value: string) {
  return normalizeHeader(value).replace(/[^a-z0-9]+/g, "");
}

function parseMoney(value: SpreadsheetCell) {
  if (typeof value === "number") return roundCurrency(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? roundCurrency(parsed) : 0;
  }
  return 0;
}

type HunterContribution = {
  amount: number;
  source: "Meta Hunter" | "Studio Hunter";
  person?: Person;
};

function formatHunterAllocationBreakdown(items: HunterContribution[]) {
  if (!items.length) return "sem pessoas alocadas";
  return items
    .map((item) => `${item.person?.name ?? "Pessoa não encontrada"} ${formatCurrency(item.amount)} (${item.source})`)
    .join("; ");
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function getCustomerTarget(customer: Customer) {
  return roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget + customer.studioTarget);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function isSameDisplayedCurrency(left: number, right: number) {
  return Math.round(left) === Math.round(right);
}
