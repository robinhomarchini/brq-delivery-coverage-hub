import readWorkbook from "read-excel-file/node";

const requiredHeaders = {
  name: "nome",
  salary: "salario",
  manager: "gestor",
} as const;

export interface ParsedEmployeeImportRow {
  rowNumber: number;
  name: string;
  normalizedName: string;
  salary: number | null;
  managerName: string;
  managerKey: string;
}

export interface ParsedEmployeeImport {
  rows: ParsedEmployeeImportRow[];
  headerRowNumber: number;
}

export class EmployeeImportParseError extends Error {}

export async function parseEmployeeImportWorkbook(buffer: Buffer): Promise<ParsedEmployeeImport> {
  let sheets: Array<{ sheet: string; data: unknown[][] }>;
  try {
    sheets = await readWorkbook(buffer) as unknown as Array<{ sheet: string; data: unknown[][] }>;
  } catch {
    throw new EmployeeImportParseError("Não foi possível ler a planilha. Confirme que o arquivo é um .xlsx válido.");
  }
  return parseEmployeeImportSheets(sheets);
}

export function parseEmployeeImportSheets(sheets: Array<{ sheet: string; data: unknown[][] }>): ParsedEmployeeImport {
  const parsedSheets: ParsedEmployeeImport[] = [];
  for (const sheet of sheets) {
    try {
      parsedSheets.push(parseEmployeeImportRows(sheet.data));
    } catch (error) {
      if (
        error instanceof EmployeeImportParseError
        && error.message.includes("colunas Nome, Salário e Gestor")
      ) {
        continue;
      }
      throw error;
    }
  }
  if (!parsedSheets.length) {
    throw new EmployeeImportParseError("A planilha precisa conter as colunas Nome, Salário e Gestor em pelo menos uma aba.");
  }
  return {
    rows: parsedSheets.flatMap((sheet) => sheet.rows),
    headerRowNumber: parsedSheets[0].headerRowNumber,
  };
}

export function parseEmployeeImportRows(sheetRows: unknown[][]): ParsedEmployeeImport {
  const headerIndex = sheetRows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(cell));
    return Object.values(requiredHeaders).every((header) => normalized.includes(header));
  });
  if (headerIndex < 0) {
    throw new EmployeeImportParseError("A planilha precisa conter as colunas Nome, Salário e Gestor.");
  }

  const normalizedHeaders = sheetRows[headerIndex].map((cell) => normalizeHeader(cell));
  const nameIndex = normalizedHeaders.indexOf(requiredHeaders.name);
  const salaryIndex = normalizedHeaders.indexOf(requiredHeaders.salary);
  const managerIndex = normalizedHeaders.indexOf(requiredHeaders.manager);

  const rows = sheetRows
    .slice(headerIndex + 1)
    .map((row, offset): ParsedEmployeeImportRow | null => {
      const name = cleanText(row[nameIndex]);
      if (!name) return null;
      const managerName = cleanText(row[managerIndex]);
      return {
        rowNumber: headerIndex + offset + 2,
        name,
        normalizedName: normalizeEmployeeName(name),
        salary: parseSalary(row[salaryIndex]),
        managerName,
        managerKey: normalizeEmployeeName(managerName),
      };
    })
    .filter((row): row is ParsedEmployeeImportRow => Boolean(row));

  if (!rows.length) {
    throw new EmployeeImportParseError("A planilha não possui linhas de funcionários para importar.");
  }

  return { rows, headerRowNumber: headerIndex + 1 };
}

export function normalizeEmployeeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: unknown) {
  return normalizeEmployeeName(cleanText(value));
}

function cleanText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseSalary(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? roundCurrency(value) : null;
  }
  const raw = cleanText(value);
  if (!raw) return null;

  const withoutCurrency = raw.replace(/[^\d,.-]/g, "");
  const normalized = withoutCurrency.includes(",")
    ? withoutCurrency.replace(/\./g, "").replace(",", ".")
    : withoutCurrency;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? roundCurrency(parsed) : null;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
