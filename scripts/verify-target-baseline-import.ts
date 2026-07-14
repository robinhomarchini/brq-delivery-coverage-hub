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

console.log("Target baseline import QA checks passed.");
