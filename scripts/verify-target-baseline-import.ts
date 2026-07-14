import { parseTargetBaselineRows, type SpreadsheetCell } from "../src/lib/target-baseline-import";

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

console.log("Target baseline import QA checks passed.");
