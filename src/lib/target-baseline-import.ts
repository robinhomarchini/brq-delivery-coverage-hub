import type { Customer, Person, TargetAllocation } from "@/data/mockData";
import { isHunterRole } from "@/lib/roles";

export type SpreadsheetCell = unknown;

export interface TargetBaselineRow {
  rowNumber: number;
  customerName: string;
  businessUnit: string;
  hunterTarget: number;
  farmerRenewalTarget: number;
  totalTarget: number;
  responsibleCode: string;
}

export interface TargetBaselineComparison {
  key: string;
  row: TargetBaselineRow;
  effectiveHunterTarget: number;
  effectiveFarmerRenewalTarget: number;
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
  field: "hunterTarget" | "farmerRenewalTarget" | "revenue";
  label: string;
  currentValue: number;
  importedValue: number;
  delta: number;
}

const requiredHeaders = {
  customerName: ["cliente", "customer", "nome do cliente"],
  businessUnit: ["bu", "business unit"],
  hunterTarget: ["target rl hunter", "meta hunter", "hunter"],
  farmerRenewalTarget: ["target rl farmer", "meta farmer", "renovacao", "renovação", "renovacao ampliacao", "renovação ampliação"],
  totalTarget: ["total rl 2026", "meta total", "total"],
  responsibleCode: ["resp", "responsavel", "responsável", "hunter responsavel", "hunter responsável"],
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

  const headers = rows[0].map((cell) => normalizeHeader(String(cell ?? "")));
  const indexes = {
    customerName: findHeaderIndex(headers, requiredHeaders.customerName, "Cliente"),
    businessUnit: findHeaderIndex(headers, requiredHeaders.businessUnit, "BU"),
    hunterTarget: findHeaderIndex(headers, requiredHeaders.hunterTarget, "Target RL Hunter"),
    farmerRenewalTarget: findHeaderIndex(headers, requiredHeaders.farmerRenewalTarget, "Target RL Farmer"),
    totalTarget: findHeaderIndex(headers, requiredHeaders.totalTarget, "Total RL 2026"),
    responsibleCode: findHeaderIndex(headers, requiredHeaders.responsibleCode, "resp"),
  };

  return rows.slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      customerName: String(row[indexes.customerName] ?? "").trim(),
      businessUnit: String(row[indexes.businessUnit] ?? "").trim(),
      hunterTarget: parseMoney(row[indexes.hunterTarget]),
      farmerRenewalTarget: parseMoney(row[indexes.farmerRenewalTarget]),
      totalTarget: parseMoney(row[indexes.totalTarget]),
      responsibleCode: String(row[indexes.responsibleCode] ?? "").trim(),
    }))
    .filter((row) => row.customerName);
}

export function buildTargetBaselineComparisons(
  baselineRows: TargetBaselineRow[],
  customers: Customer[],
  people: Person[],
  targetAllocations: TargetAllocation[],
  year: number,
): TargetBaselineComparison[] {
  const customersByName = new Map(customers.map((customer) => [normalizeName(customer.name), customer]));

  return baselineRows.map((row) => {
    const customer = customersByName.get(normalizeName(row.customerName));
    const importedHunter = roundCurrency(row.hunterTarget);
    const importedFarmerRenewal = roundCurrency(row.farmerRenewalTarget);
    const importedRevenue = roundCurrency(importedHunter + importedFarmerRenewal);
    const sheetTotalDifference = roundCurrency(row.totalTarget - importedRevenue);

    if (!customer) {
      return {
        key: `${row.rowNumber}-${row.customerName}`,
        row,
        effectiveHunterTarget: importedHunter,
        effectiveFarmerRenewalTarget: importedFarmerRenewal,
        effectiveRevenue: importedRevenue,
        valueStatus: "missing_customer",
        hunterStatus: "warning",
        hunterMessage: "Cliente não encontrado na base.",
        differences: [],
        sheetTotalDifference,
      };
    }

    const differences = buildDifferences(customer, importedHunter, importedFarmerRenewal, importedRevenue);
    const importedTotalIsValid = isSameDisplayedCurrency(row.totalTarget, importedRevenue);
    const hunterCheck = validateHunterConsistency(row, customer, people, targetAllocations, year);

    return {
      key: customer.id,
      row,
      effectiveHunterTarget: importedHunter,
      effectiveFarmerRenewalTarget: importedFarmerRenewal,
      effectiveRevenue: importedRevenue,
      customer,
      matchedCustomerName: customer.name,
      updateCandidate: {
        ...customer,
        hunterTarget: importedHunter,
        farmerRenewalTarget: importedFarmerRenewal,
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

function buildDifferences(customer: Customer, hunterTarget: number, farmerRenewalTarget: number, revenue: number) {
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
      field: "revenue",
      label: "Meta Total",
      currentValue: roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget),
      importedValue: revenue,
      delta: revenue - roundCurrency(customer.hunterTarget + customer.farmerRenewalTarget),
    },
  ];
  return candidates.filter((difference) => !isSameDisplayedCurrency(difference.currentValue, difference.importedValue));
}

function validateHunterConsistency(
  row: TargetBaselineRow,
  customer: Customer,
  people: Person[],
  targetAllocations: TargetAllocation[],
  year: number,
) {
  const importedHunter = roundCurrency(row.hunterTarget);
  const importedFarmerRenewal = roundCurrency(row.farmerRenewalTarget);
  const responsiblePerson = findResponsiblePerson(row.responsibleCode, people);
  const hunterAllocations = targetAllocations
    .filter((allocation) => allocation.customerId === customer.id && allocation.year === year && allocation.type === "hunter" && allocation.amount > zeroMoneyTolerance)
    .map((allocation) => ({
      allocation,
      person: people.find((person) => person.id === allocation.personId),
    }));
  const allocatedHunterTotal = roundCurrency(hunterAllocations.reduce((total, item) => total + item.allocation.amount, 0));

  if (importedHunter <= zeroMoneyTolerance) {
    if (allocatedHunterTotal > zeroMoneyTolerance) {
      const allocationMessage = `${formatPersonNames(hunterAllocations)} com ${formatCurrency(allocatedHunterTotal)}`;
      if (importedFarmerRenewal > zeroMoneyTolerance) {
        return {
          status: "warning" as const,
          message: `Planilha classifica ${formatCurrency(importedFarmerRenewal)} como Renovação + Ampliação, mas o sistema está com Hunter alocado para ${allocationMessage}. Corrija Metas por Pessoa ou aplique a planilha como baseline.`,
        };
      }
      return {
        status: "warning" as const,
        message: `Planilha sem meta Hunter, mas o sistema está com Hunter alocado para ${allocationMessage}.`,
      };
    }
    return { status: "not_applicable" as const, message: "Sem meta Hunter na planilha." };
  }

  if (!responsiblePerson) {
    return {
      status: "warning" as const,
      message: row.responsibleCode
        ? `Responsável "${row.responsibleCode}" não foi encontrado nas Pessoas cadastradas.`
        : "Sem responsável definido na planilha.",
    };
  }

  if (!isHunterRole(responsiblePerson.roleType)) {
    return {
      status: "warning" as const,
      message: `${responsiblePerson.name} aparece na planilha, mas não está cadastrado como Hunter/Hunter + Farmer.`,
    };
  }

  if (!hunterAllocations.length) {
    return {
      status: "warning" as const,
      message: `Planilha indica Hunter ${responsiblePerson.name} com ${formatCurrency(importedHunter)}, mas não há meta Hunter alocada no sistema.`,
    };
  }

  const hasResponsibleAllocation = hunterAllocations.some((item) => item.person?.id === responsiblePerson.id);
  if (!hasResponsibleAllocation) {
    return {
      status: "warning" as const,
      message: `Planilha indica ${responsiblePerson.name}; app tem ${formatPersonNames(hunterAllocations)}.`,
    };
  }

  if (!isSameDisplayedCurrency(allocatedHunterTotal, importedHunter)) {
    return {
      status: "warning" as const,
      message: `Valor Hunter divergente: planilha ${formatCurrency(importedHunter)} vs. sistema ${formatCurrency(allocatedHunterTotal)} para ${responsiblePerson.name}.`,
    };
  }

  return { status: "ok" as const, message: `Hunter consistente com ${responsiblePerson.name}.` };
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

function formatPersonNames(items: Array<{ person?: Person }>) {
  const names = Array.from(new Set(items.map((item) => item.person?.name ?? "Pessoa não encontrada")));
  return names.join(", ");
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function isSameDisplayedCurrency(left: number, right: number) {
  return Math.round(left) === Math.round(right);
}
