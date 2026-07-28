import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  EmployeeImportParseError,
  normalizeEmployeeName,
  parseEmployeeImportWorkbook,
  parseEmployeeImportRows,
  parseEmployeeImportSheets,
} from "../src/server/employee-import/parser";

const parsed = parseEmployeeImportRows([
  ["Relação de Ativos"],
  [],
  ["Matrícula", "Nome", "Cargo", "Outro", "Salário", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "Gestor"],
  [1, "André da Silva", "Analista", null, 12345.67, null, null, null, null, null, null, null, null, null, null, "Gestora Á"],
  [2, "Pessoa Sem Salário", "Analista", null, null, null, null, null, null, null, null, null, null, null, null, "Gestora Á"],
]);

assert.equal(parsed.headerRowNumber, 3);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].normalizedName, "andre da silva");
assert.equal(parsed.rows[0].salary, 12345.67);
assert.equal(parsed.rows[0].managerKey, "gestora a");
assert.equal(parsed.rows[1].salary, null);
assert.equal(normalizeEmployeeName("  João   D'Ávila  "), "joao d avila");

const allProfiles = parseEmployeeImportSheets([
  {
    sheet: "Time Hunter",
    data: [
      ["Nome", "Salário", "Gestor"],
      ["Pessoa Hunter", 10000, "Diretora Comercial"],
    ],
  },
  {
    sheet: "Time Operações",
    data: [
      ["Nome", "Salário", "Gestor"],
      ["Pessoa Delivery", 9000, "Diretor Delivery"],
      ["Pessoa Diretora", 20000, "Presidente"],
    ],
  },
]);
assert.deepEqual(
  allProfiles.rows.map((row) => row.name),
  ["Pessoa Hunter", "Pessoa Delivery", "Pessoa Diretora"],
);

assert.throws(
  () => parseEmployeeImportRows([["Nome", "Salário"], ["Pessoa", 1000]]),
  (error) => error instanceof EmployeeImportParseError
    && error.message.includes("Nome, Salário e Gestor"),
);

void verifyReferenceWorkbook().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function verifyReferenceWorkbook() {
  const workbookPath = process.argv[2];
  if (workbookPath) {
    const workbook = await parseEmployeeImportWorkbook(await fs.readFile(workbookPath));
    assert.ok(workbook.rows.length > 1000, "The supplied reference workbook must consolidate all valid worksheets.");
    assert.ok(workbook.rows.some((row) => row.salary !== null), "The supplied workbook must contain valid salaries.");
    assert.ok(workbook.rows.some((row) => row.managerKey), "The supplied workbook must contain managers.");
    console.log(`Reference workbook parsed: ${workbook.rows.length} employee row(s).`);
  }
  console.log("Employee import parser checks passed.");
}
