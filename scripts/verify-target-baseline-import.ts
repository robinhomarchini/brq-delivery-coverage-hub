import type { Customer, Person, TargetAllocation } from "../src/data/mockData";
import { buildTargetBaselineComparisons, parseTargetBaselineRows, type SpreadsheetCell } from "../src/lib/target-baseline-import";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const firstTableHeader = ["Cliente", "BU", "Target RL Hunter", "Target RL Farmer", "Total RL 2026"];
const firstTableRow = ["AGIBANK", "BU Financial", 999_999, 0, 999_999];
const officialTableHeader = ["Cliente", "BU", "Target RL Hunter", "Target RL Farmer", "Total RL 2026"];
const officialTableRows = [
  ["AGIBANK", "BU Financial", 100_000, 0, 100_000],
  ["OUTRA BU", "BU Outros", 500_000, 0, 500_000],
  ["Total", "BU Financial", 100_000, 0, 100_000],
];

const rows: SpreadsheetCell[][] = [
  firstTableHeader,
  firstTableRow,
  ...Array.from({ length: 122 }, () => []),
  officialTableHeader,
  ...officialTableRows,
];

const parsedRows = parseTargetBaselineRows(rows);

assert(parsedRows.length === 1, "A Curva principal deve ignorar o primeiro quadro e importar apenas clientes Financial do quadro oficial.");
assert(parsedRows[0]?.customerName === "AGIBANK", "A linha oficial do cliente AGIBANK deve ser mantida.");
assert(parsedRows[0]?.hunterTarget === 100_000, "A linha do primeiro quadro não deve sobrescrever o valor oficial da linha 125+.");
assert(parsedRows[0]?.rowNumber === 126, "O número da linha importada deve apontar para a linha real da planilha.");

const officialFinancialOnlyRows: SpreadsheetCell[][] = [
  firstTableHeader,
  firstTableRow,
  ...Array.from({ length: 122 }, () => []),
  ["Cliente", "Hunter Novo - AWS", "Target RL Hunter", "Target RL Farmer", "Total RL 2026"],
  ["AGIBANK", 100_000, 100_000, 0, 100_000],
];

const parsedFinancialOnlyRows = parseTargetBaselineRows(officialFinancialOnlyRows);

assert(parsedFinancialOnlyRows.length === 1, "O segundo quadro Financial sem coluna BU deve ser aceito como BU Financial.");
assert(parsedFinancialOnlyRows[0]?.businessUnit === "BU Financial", "Quando a coluna BU não existe no segundo quadro, a BU deve ser inferida como Financial.");

const compactReaderRows: SpreadsheetCell[][] = [
  firstTableHeader,
  firstTableRow,
  ["Cliente", "Hunter Novo - AWS", "Target RL Hunter", "Target RL Farmer", "Total RL 2026"],
  ["AGIBANK", 100_000, 100_000, 0, 100_000],
];

const parsedCompactReaderRows = parseTargetBaselineRows(compactReaderRows);

assert(parsedCompactReaderRows.length === 1, "O parser deve escolher o último cabeçalho válido quando o leitor XLSX não preservar linhas vazias.");
assert(parsedCompactReaderRows[0]?.hunterTarget === 100_000, "O parser deve usar o segundo quadro Financial, não o primeiro quadro duplicado.");

const aleloCustomer: Customer = {
  id: "customer-alelo",
  name: "ALELO",
  industry: "Financial Services",
  directorResponsibleId: "director-ca",
  managerResponsibleIds: [],
  hunterTarget: 11_033_497,
  farmerRenewalTarget: 3_177_599,
  studioHunterTarget: 6_600_149,
  studioTarget: 2_431_414,
  revenue: 14_211_096,
  margin: 35.8,
  strategicAccount: false,
  lifecycleStatus: "active",
};

const [aleloComparison] = buildTargetBaselineComparisons(
  [{
    rowNumber: 126,
    customerName: "ALELO",
    businessUnit: "BU Financial",
    hunterTarget: 11_033_497,
    farmerRenewalTarget: 3_177_599,
    studioTarget: 0,
    totalTarget: 14_211_096,
    responsibleCode: "",
  }],
  [aleloCustomer],
  [],
  [],
  [],
  2026,
);

assert(aleloComparison?.valueStatus === "ok", "A Curva principal não deve marcar divergência por Studio quando Hunter, Renovação e Total do cliente batem.");
assert(aleloComparison?.updateCandidate?.studioTarget === aleloCustomer.studioTarget, "Aplicar a Curva principal deve preservar a meta de Studio do cliente.");
assert(aleloComparison?.effectiveRevenue === 14_211_096, "O total da Curva principal deve ser o total oficial do cliente, sem somar Studio novamente.");

const hunterPerson: Person = {
  id: "person-hunter",
  name: "Hunter Sistema",
  jobTitle: "Gerente Executivo de Vendas",
  roleType: "Hunter",
  clientIds: ["customer-itau"],
  active: true,
  lifecycleStatus: "active",
  isManager: false,
  hierarchyLevel: 3,
};
const itauCustomer: Customer = {
  ...aleloCustomer,
  id: "customer-itau",
  name: "BANCO ITAÚ S.A.",
  hunterTarget: 44_089_655,
  farmerRenewalTarget: 192_344_141,
  studioHunterTarget: 0,
  studioTarget: 0,
  revenue: 236_433_796,
};
const itauAllocation: TargetAllocation = {
  id: "target-itau-hunter",
  customerId: "customer-itau",
  personId: "person-hunter",
  type: "hunter",
  year: 2026,
  amount: 40_000_000,
};
const [itauComparison] = buildTargetBaselineComparisons(
  [{
    rowNumber: 130,
    customerName: "BANCO ITAÚ S.A.",
    businessUnit: "BU Financial",
    hunterTarget: 44_089_655,
    farmerRenewalTarget: 192_344_141,
    studioTarget: 0,
    totalTarget: 236_433_796,
    responsibleCode: "outro hunter",
  }],
  [itauCustomer],
  [hunterPerson],
  [itauAllocation],
  [],
  2026,
);

assert(itauComparison?.valueStatus === "ok", "Diferença informativa de Hunter cadastrado não deve afetar o status financeiro da Curva principal.");
assert(itauComparison?.hunterStatus === "ok", "Hunter da planilha é informativo e não deve gerar alerta quando os valores da Curva batem.");

console.log("Target baseline import QA checks passed.");
