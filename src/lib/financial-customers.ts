import { revenuePlans, type RevenuePlan } from "@/data/customerPortfolioData";

export const financialSourceCustomerNames = [
  "AGIBANK",
  "ALELO",
  "ASA INVESTMENTS",
  "ASSOCIAÇÃO OPEN FINANCE",
  "B3",
  "B3 IP",
  "BANCO ABC",
  "BANCO B3",
  "BANCO BOCOM",
  "BANCO BS2",
  "BANCO ITAÚ S.A.",
  "BANCO PACTUAL",
  "BANCO RCI",
  "BBTS",
  "BRADESCO",
  "BULLLA",
  "CIP",
  "CREDIT SUISSE",
  "CRT4",
  "CSF",
  "CSU",
  "EDENRED",
  "FIS",
  "FUNDAÇÃO ITAÚ",
  "INTEL",
  "LIVELO S.A.",
  "NEW LOGO",
  "OPEA",
  "PICPAY",
  "PISMO",
  "PROFESSIONAL SERVICES",
  "QUOD",
  "REDECARD",
  "SANTANDER",
  "SICOOB",
  "SICREDI",
  "TRAVELEX",
  "VISA",
  "VOTORANTIM",
  "XP INVESTIMENTOS",
  "ZURICH",
] as const;

const itauCustomerNames = new Set(["BANCO ITAÚ S.A.", "FUNDAÇÃO ITAÚ"].map(normalizeName));
const caCustomerNames = new Set(["ALELO", "BANCO ITAÚ S.A.", "CIP", "FUNDAÇÃO ITAÚ"].map(normalizeName));

export function getFinancialCustomerId(name: string) {
  return `client-${normalizeName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function getFinancialCustomerGovernance(name: string) {
  const normalized = normalizeName(name);
  return {
    directorResponsibleId: caCustomerNames.has(normalized) ? "ca" : "ane",
    managerResponsibleIds: itauCustomerNames.has(normalized)
      ? ["bruno", "orion", "fernanda", "bonfim"]
      : ["ana"],
  };
}

export function getFinancialPlanForCustomerName(name: string): RevenuePlan | undefined {
  const normalized = normalizeName(name);
  return revenuePlans.find((plan) =>
    normalizeName(plan.customerName) === normalized
    || plan.sourceCustomerNames.some((sourceName) => normalizeName(sourceName) === normalized)
  );
}

export function getFinancialCustomerMetric(name: string, metric: "revenueCurrent" | "revenueTarget" | "hunterRevenue" | "deliveryFarmerRevenue") {
  const plan = getFinancialPlanForCustomerName(name);
  if (!plan) return 0;
  const sourceNames = plan.sourceCustomerNames.length ? plan.sourceCustomerNames : [plan.customerName];
  return splitAmount(plan[metric], sourceNames.length, getFinancialSourceIndex(plan, name));
}

export function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function splitAmount(amount: number, parts: number, index: number) {
  if (parts <= 1) return amount;
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / parts);
  const remainder = cents - base * parts;
  return (base + (index < remainder ? 1 : 0)) / 100;
}

function getFinancialSourceIndex(plan: RevenuePlan, name: string) {
  const normalized = normalizeName(name);
  const index = plan.sourceCustomerNames.findIndex((sourceName) => normalizeName(sourceName) === normalized);
  return index >= 0 ? index : 0;
}
