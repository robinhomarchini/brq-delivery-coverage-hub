/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const { unzipSync, strFromU8 } = require("fflate");

const workbookPath = process.argv[2];
if (!workbookPath) {
  throw new Error("Usage: node scripts/inspect-xlsx-headers.cjs <xlsx-path>");
}

const zip = unzipSync(new Uint8Array(fs.readFileSync(workbookPath)));
const sheetXml = strFromU8(zip["xl/worksheets/sheet1.xml"]);
const workbookXml = strFromU8(zip["xl/workbook.xml"]);
const sharedStringsXml = zip["xl/sharedStrings.xml"] ? strFromU8(zip["xl/sharedStrings.xml"]) : "";

const sharedStrings = Array.from(sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
  Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
    .map((textMatch) => decodeXml(textMatch[1]))
    .join(""),
);

const sheetName = workbookXml.match(/<sheet[^>]* name="([^"]+)"/)?.[1] ?? "";
const dimension = sheetXml.match(/<dimension ref="([^"]+)"/)?.[1] ?? "";
const autoFilter = sheetXml.match(/<autoFilter ref="([^"]+)"/)?.[1] ?? "";
const rowThree = sheetXml.match(/<row[^>]* r="3"[\s\S]*?<\/row>/)?.[0] ?? "";
const headers = parseCells(rowThree, 3).map((cell) => ({
  cell: cell.cell,
  value: cell.value,
}));
const firstRows = [1, 2, 3, 4, 5].map((rowNumber) => {
  const rowXml = sheetXml.match(new RegExp(`<row[^>]* r="${rowNumber}"[\\s\\S]*?<\\/row>`))?.[0] ?? "";
  return {
    row: rowNumber,
    cells: parseCells(rowXml, rowNumber),
  };
});

console.log(JSON.stringify({ workbookPath, sheetName, dimension, autoFilter, headers, firstRows }, null, 2));

function parseCells(rowXml, rowNumber) {
  return Array.from(rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g)).map((match) => {
    const attrs = match[1] ?? match[3] ?? "";
    const column = attrs.match(/ r="([A-Z]+)\d+"/)?.[1] ?? "";
    const type = attrs.match(/ t="([^"]+)"/)?.[1];
    return {
      cell: `${column}${rowNumber}`,
      value: match[2] ? readCellValue(type, match[2]) : "",
    };
  });
}

function readCellValue(type, body) {
  if (type === "inlineStr") {
    return decodeXml(Array.from(body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => match[1]).join(""));
  }
  const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  const formula = body.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1];
  return formula ? `=${decodeXml(formula)}${value ? ` [${value}]` : ""}` : decodeXml(value);
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
