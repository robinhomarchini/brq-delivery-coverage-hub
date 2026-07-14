import { strFromU8, unzipSync } from "fflate";

export function readXlsxSheetRows(buffer: ArrayBuffer, sheetName?: string) {
  const files = unzipSync(new Uint8Array(buffer));
  const sheetPath = getWorksheetPath(files, sheetName);
  const sheetEntry = files[sheetPath];
  if (!sheetEntry) {
    throw new Error(sheetName ? `Aba não encontrada na planilha: ${sheetName}.` : "Não foi possível localizar a primeira aba da planilha.");
  }

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

function getWorksheetPath(files: Record<string, Uint8Array>, sheetName?: string) {
  if (!sheetName) return "xl/worksheets/sheet1.xml";

  const workbook = files["xl/workbook.xml"];
  const relationships = files["xl/_rels/workbook.xml.rels"];
  if (!workbook || !relationships) return "xl/worksheets/sheet1.xml";

  const workbookXml = new DOMParser().parseFromString(strFromU8(workbook), "application/xml");
  const relsXml = new DOMParser().parseFromString(strFromU8(relationships), "application/xml");
  const sheet = Array.from(workbookXml.getElementsByTagName("sheet"))
    .find((node) => normalizeSheetName(node.getAttribute("name") ?? "") === normalizeSheetName(sheetName));
  const relationshipId = sheet?.getAttribute("r:id");
  if (!relationshipId) return "xl/worksheets/sheet1.xml";

  const relationship = Array.from(relsXml.getElementsByTagName("Relationship"))
    .find((node) => node.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target") ?? "";
  if (!target) return "xl/worksheets/sheet1.xml";
  return target.startsWith("xl/") ? target : `xl/${target.replace(/^\//, "")}`;
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

function normalizeSheetName(value: string) {
  return value.trim().toLowerCase();
}
