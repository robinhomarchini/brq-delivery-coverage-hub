import { strFromU8, unzipSync } from "fflate";

export function readXlsxSheetRows(buffer: ArrayBuffer, sheetName?: string) {
  const files = unzipSync(new Uint8Array(buffer));
  const sheetPath = sheetName ? getRequiredWorksheetPath(files, sheetName) : getFirstWorksheetPath(files);
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

function getRequiredWorksheetPath(files: Record<string, Uint8Array>, sheetName: string) {
  const workbook = files["xl/workbook.xml"];
  const relationships = files["xl/_rels/workbook.xml.rels"];
  if (!workbook || !relationships) {
    throw new Error(`Não foi possível ler o índice de abas da planilha para localizar: ${sheetName}.`);
  }

  const workbookXml = new DOMParser().parseFromString(strFromU8(workbook), "application/xml");
  const relsXml = new DOMParser().parseFromString(strFromU8(relationships), "application/xml");
  const sheets = Array.from(workbookXml.getElementsByTagName("sheet"));
  const sheet = sheets.find((node) => normalizeSheetName(node.getAttribute("name") ?? "") === normalizeSheetName(sheetName));
  if (!sheet) {
    const availableSheets = sheets.map((node) => node.getAttribute("name") ?? "").filter(Boolean).join(", ");
    throw new Error(`Aba obrigatória não encontrada na planilha: ${sheetName}. Abas disponíveis: ${availableSheets || "nenhuma"}.`);
  }

  const relationshipId = getRelationshipId(sheet);
  if (!relationshipId) {
    throw new Error(`Aba ${sheetName} encontrada sem relacionamento interno no arquivo XLSX.`);
  }

  const relationship = Array.from(relsXml.getElementsByTagName("Relationship"))
    .find((node) => node.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target") ?? "";
  if (!target) {
    throw new Error(`Aba ${sheetName} encontrada, mas sem destino interno no arquivo XLSX.`);
  }

  const worksheetPath = normalizeWorksheetTarget(target);
  if (!files[worksheetPath]) {
    throw new Error(`Aba ${sheetName} aponta para uma planilha interna inexistente: ${worksheetPath}.`);
  }
  return worksheetPath;
}

function getFirstWorksheetPath(files: Record<string, Uint8Array>) {
  return Object.keys(files)
    .filter((filePath) => filePath.startsWith("xl/worksheets/") && filePath.endsWith(".xml"))
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }))[0] ?? "xl/worksheets/sheet1.xml";
}

function getRelationshipId(sheetNode: Element) {
  return sheetNode.getAttribute("r:id")
    ?? sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
    ?? Array.from(sheetNode.attributes).find((attribute) =>
      attribute.localName === "id" && (attribute.name === "r:id" || attribute.namespaceURI?.includes("relationships"))
    )?.value
    ?? "";
}

function normalizeWorksheetTarget(target: string) {
  const normalizedTarget = target.replace(/\\/g, "/").replace(/^\//, "");
  if (normalizedTarget.startsWith("xl/")) return normalizeZipPath(normalizedTarget);
  return normalizeZipPath(`xl/${normalizedTarget}`);
}

function normalizeZipPath(filePath: string) {
  const parts: string[] = [];
  filePath.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
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
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
