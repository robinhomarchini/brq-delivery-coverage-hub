"use client";

import { Eye, FileSpreadsheet, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

export type ReportCellValue = string | number | boolean | null | undefined;

export interface ReportColumn<TRow> {
  key: string;
  label: string;
  value: (row: TRow) => ReportCellValue;
  format?: "text" | "number" | "currency" | "percent";
  align?: "left" | "right" | "center";
}

export type ReportRowStyle = "regular" | "subtotal" | "total";

export interface ReportCustomExport {
  label: string;
  title: string;
  filename: string;
  worksheetName?: string;
  rows: unknown[];
  columns: ReportColumn<unknown>[];
  rowStyle?: (row: unknown) => ReportRowStyle;
}

export function ReportExportActions<TRow>({
  title,
  filename,
  rows,
  columns,
  customExports = [],
  renderPreview,
}: {
  title: string;
  filename: string;
  rows: TRow[];
  columns: ReportColumn<TRow>[];
  customExports?: ReportCustomExport[];
  renderPreview?: (rows: TRow[]) => ReactNode;
}) {
  const disabled = rows.length === 0;
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewRows = useMemo(() => rows.slice(0, 50), [rows]);
  const availableCustomExports = customExports.filter((item) => item.rows.length > 0);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setPreviewOpen(true)}
          title="Mostra na tela a mesma seleção que será exportada."
        >
          <Eye className="h-4 w-4" />
          Prévia
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => exportRowsAsCsv(title, filename, rows, columns)}
        >
          <FileText className="h-4 w-4" />
          CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => exportRowsAsExcel(title, filename, rows, columns)}
          title="Exporta um .xlsx compatível com Excel, mantendo números como números."
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </Button>
        {availableCustomExports.map((customExport) => (
          <Button
            key={`${customExport.label}-${customExport.filename}`}
            type="button"
            variant="outline"
            onClick={() => exportRowsAsExcel(
              customExport.title,
              customExport.filename,
              customExport.rows,
              customExport.columns,
              {
                worksheetName: customExport.worksheetName,
                rowStyle: customExport.rowStyle,
                officialLayout: customExport.columns.length === 6,
              },
            )}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {customExport.label}
          </Button>
        ))}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-7xl">
          <DialogHeader>
            <DialogTitle>Prévia da exportação</DialogTitle>
            <DialogDescription>
              {title} · {rows.length} linha(s){rows.length > previewRows.length ? ` · exibindo primeiras ${previewRows.length}` : ""}
            </DialogDescription>
          </DialogHeader>
          {renderPreview ? (
            <div className="max-h-[70vh] overflow-auto rounded-xl border bg-slate-50/70 p-3">
              {renderPreview(previewRows)}
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-xl border">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.key} className={getAlignClassName(column, true)}>
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {columns.map((column) => (
                        <TableCell key={column.key} className={getAlignClassName(column)}>
                          {formatPreviewCell(column.value(row), column.format)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => exportRowsAsCsv(title, filename, rows, columns)}>
              <FileText className="h-4 w-4" />
              Baixar CSV
            </Button>
            <Button type="button" onClick={() => exportRowsAsExcel(title, filename, rows, columns)}>
              <FileSpreadsheet className="h-4 w-4" />
              Baixar Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatPreviewCell(value: ReportCellValue, format: ReportColumn<unknown>["format"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "currency" && typeof value === "number") return formatCurrency(value);
  if (format === "percent" && typeof value === "number") return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
  if (format === "number" && typeof value === "number") return new Intl.NumberFormat("pt-BR").format(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function getAlignClassName<TRow>(column: ReportColumn<TRow>, header = false) {
  const align = column.align ?? (column.format === "currency" || column.format === "number" || column.format === "percent" ? "right" : "left");
  if (align === "right") return header ? "text-right" : "text-right font-medium tabular-nums";
  if (align === "center") return "text-center";
  return "";
}

function exportRowsAsCsv<TRow>(
  title: string,
  filename: string,
  rows: TRow[],
  columns: ReportColumn<TRow>[],
) {
  const header = columns.map((column) => sanitizeCsvText(column.label)).join(";");
  const body = rows.map((row) => columns.map((column) => formatCsvCell(column.value(row), column.format)).join(";"));
  const csv = ["sep=;", sanitizeCsvText(title), header, ...body].join("\r\n");
  downloadBlob(`\uFEFF${csv}`, `${filename}.csv`, "text/csv;charset=utf-8");
}

function exportRowsAsExcel<TRow>(
  title: string,
  filename: string,
  rows: TRow[],
  columns: ReportColumn<TRow>[],
  options: {
    worksheetName?: string;
    rowStyle?: (row: TRow) => ReportRowStyle;
    officialLayout?: boolean;
  } = {},
) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const workbook = buildXlsxWorkbook({
    title,
    generatedAt,
    worksheetName: options.worksheetName ?? "Relatorio",
    rows,
    columns,
    rowStyle: options.rowStyle,
    officialLayout: options.officialLayout,
  });

  downloadBytes(workbook, `${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function formatCsvCell(value: ReportCellValue, format: ReportColumn<unknown>["format"]) {
  if (value === null || value === undefined) return "";
  if (format && format !== "text" && typeof value === "number") return formatCsvNumber(value);
  return sanitizeCsvText(value);
}

function sanitizeCsvText(value: ReportCellValue) {
  const text = String(value ?? "").replaceAll("\"", "\"\"");
  const safeText = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${safeText}"`;
}

function formatCsvNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

function getCellValue<TRow>(column: ReportColumn<TRow>, row: TRow): WorkbookCell {
  const value = column.value(row);
  return value === undefined ? null : value;
}

type WorkbookCell = string | number | boolean | null;
type WorkbookStyle = "title" | "header" | "text" | "number" | "currency" | "percent" | "subtotalText" | "subtotalNumber" | "subtotalCurrency" | "subtotalPercent" | "totalText" | "totalCurrency" | "totalPercent";
type WorksheetCell = {
  value: WorkbookCell;
  style: WorkbookStyle;
  formula?: string;
};
type WorksheetRow = {
  cells: WorksheetCell[];
};

function buildXlsxWorkbook<TRow>({
  title,
  generatedAt,
  worksheetName,
  rows,
  columns,
  rowStyle,
  officialLayout,
}: {
  title: string;
  generatedAt: string;
  worksheetName: string;
  rows: TRow[];
  columns: ReportColumn<TRow>[];
  rowStyle?: (row: TRow) => ReportRowStyle;
  officialLayout?: boolean;
}) {
  const tableRows: WorksheetRow[] = [
    { cells: [{ value: title, style: "title" }] },
    { cells: [{ value: `Gerado em ${generatedAt} · BRQ Delivery Coverage Hub`, style: "text" }] },
    { cells: columns.map((column) => ({ value: column.label, style: "header" })) },
    ...rows.map((row) => {
      const style = rowStyle?.(row) ?? "regular";
      return {
        cells: columns.map((column) => {
          const format = column.format ?? "text";
          const value = getCellValue(column, row);
          const baseStyle = getWorkbookStyle(format, style);
          return { value, style: baseStyle };
        }),
      };
    }),
  ];
  const sheetXml = buildWorksheetXml(tableRows, {
    worksheetName,
    columnCount: columns.length,
    officialLayout,
  });
  const files: Record<string, string | Uint8Array> = {
    "[Content_Types].xml": buildContentTypesXml(),
    "_rels/.rels": buildRootRelationshipsXml(),
    "docProps/app.xml": buildAppPropertiesXml(),
    "docProps/core.xml": buildCorePropertiesXml(),
    "xl/workbook.xml": buildWorkbookXml(worksheetName),
    "xl/_rels/workbook.xml.rels": buildWorkbookRelationshipsXml(),
    "xl/styles.xml": buildStylesXml(),
    "xl/worksheets/sheet1.xml": sheetXml,
  };

  return zipStore(files);
}

function getWorkbookStyle(format: ReportColumn<unknown>["format"], rowStyle: ReportRowStyle): WorkbookStyle {
  if (rowStyle === "total") {
    if (format === "percent") return "totalPercent";
    if (format === "currency" || format === "number") return "totalCurrency";
    return "totalText";
  }
  if (rowStyle === "subtotal") {
    if (format === "percent") return "subtotalPercent";
    if (format === "currency" || format === "number") return format === "currency" ? "subtotalCurrency" : "subtotalNumber";
    return "subtotalText";
  }
  if (format === "currency") return "currency";
  if (format === "percent") return "percent";
  if (format === "number") return "number";
  return "text";
}

function buildWorksheetXml(rows: WorksheetRow[], { columnCount, officialLayout }: { worksheetName: string; columnCount: number; officialLayout?: boolean }) {
  const maxColumn = getColumnName(columnCount);
  const widths = officialLayout && columnCount === 6
    ? [24, 42, 15, 17, 15, 9]
    : Array.from({ length: columnCount }, (_, index) => index < 2 ? 26 : 18);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${maxColumn}${rows.length}"/>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr baseColWidth="10" defaultRowHeight="15"/>
  <cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>
    ${rows.map((row, rowIndex) => buildWorksheetRow(row, rowIndex + 1, columnCount)).join("\n")}
  </sheetData>
  <pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/>
  <pageSetup paperSize="9" orientation="portrait"/>
</worksheet>`;
}

function buildWorksheetRow(row: WorksheetRow, rowNumber: number, columnCount: number) {
  const paddedCells = Array.from({ length: columnCount }, (_, index) => row.cells[index] ?? { value: null, style: "text" as WorkbookStyle });
  const height = rowNumber === 3 ? " ht=\"28\"" : "";
  return `<row r="${rowNumber}" spans="1:${columnCount}"${height}>${paddedCells.map((cell, index) => buildWorksheetCell(cell, `${getColumnName(index + 1)}${rowNumber}`)).join("")}</row>`;
}

function buildWorksheetCell(cell: WorksheetCell, reference: string) {
  const styleId = styleIds[cell.style] ?? 0;
  const style = styleId ? ` s="${styleId}"` : "";
  if (cell.formula) {
    return `<c r="${reference}"${style}><f>${escapeXml(cell.formula)}</f></c>`;
  }
  if (cell.value === null || cell.value === "") {
    return `<c r="${reference}"${style}/>`;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
  }
  if (typeof cell.value === "boolean") {
    return `<c r="${reference}"${style} t="inlineStr"><is><t>${cell.value ? "Sim" : "Não"}</t></is></c>`;
  }
  return `<c r="${reference}"${style} t="inlineStr"><is><t>${escapeXml(sanitizeSpreadsheetText(String(cell.value)))}</t></is></c>`;
}

const styleIds: Record<WorkbookStyle, number> = {
  text: 0,
  title: 1,
  header: 2,
  number: 3,
  currency: 4,
  percent: 5,
  subtotalText: 6,
  subtotalNumber: 7,
  subtotalCurrency: 7,
  subtotalPercent: 8,
  totalText: 9,
  totalCurrency: 10,
  totalPercent: 11,
};

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0;(#,##0);-"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
  <fonts count="6">
    <font><sz val="10"/><name val="Arial"/></font>
    <font><b/><sz val="12"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><sz val="10"/><color rgb="FF0000FF"/><name val="Arial"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor rgb="FF1F4E79"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor rgb="FFD9E1F2"/></patternFill></fill>
  </fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="164" fontId="5" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="4" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="4" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function buildRootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildWorkbookRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildWorkbookXml(worksheetName: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sanitizeWorksheetName(worksheetName))}" sheetId="1" r:id="rId1"/></sheets>
  <calcPr calcId="191029"/>
</workbook>`;
}

function buildAppPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>BRQ Delivery Coverage Hub</Application>
</Properties>`;
}

function buildCorePropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>BRQ Delivery Coverage Hub</dc:creator>
  <dc:title>Relatório de Metas</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`;
}

function sanitizeWorksheetName(value: string) {
  return value.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31) || "Relatorio";
}

function getColumnName(columnNumber: number) {
  let name = "";
  let current = columnNumber;
  while (current > 0) {
    const modulo = (current - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    current = Math.floor((current - modulo) / 26);
  }
  return name;
}

function zipStore(files: Record<string, string | Uint8Array>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    const localHeader = createZipHeader(0x04034b50, nameBytes.length, data.length, crc, offset);
    localParts.push(localHeader, nameBytes, data);
    centralParts.push(createZipHeader(0x02014b50, nameBytes.length, data.length, crc, offset), nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = createEndOfCentralDirectory(Object.keys(files).length, centralSize, centralOffset);
  return concatBytes([...localParts, ...centralParts, end]);
}

function createZipHeader(signature: number, fileNameLength: number, dataLength: number, crc: number, offset: number) {
  const central = signature === 0x02014b50;
  const buffer = new ArrayBuffer(central ? 46 : 30);
  const view = new DataView(buffer);
  view.setUint32(0, signature, true);
  if (central) {
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, dataLength, true);
    view.setUint32(24, dataLength, true);
    view.setUint16(28, fileNameLength, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
  } else {
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, dataLength, true);
    view.setUint32(22, dataLength, true);
    view.setUint16(26, fileNameLength, true);
  }
  return new Uint8Array(buffer);
}

function createEndOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number) {
  const buffer = new ArrayBuffer(22);
  const view = new DataView(buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return new Uint8Array(buffer);
}

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = crcTable[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sanitizeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadBytes(content: Uint8Array, filename: string, type: string) {
  const body = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
