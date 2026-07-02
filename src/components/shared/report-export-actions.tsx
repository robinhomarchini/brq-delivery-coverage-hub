"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ReportCellValue = string | number | boolean | null | undefined;

export interface ReportColumn<TRow> {
  key: string;
  label: string;
  value: (row: TRow) => ReportCellValue;
  format?: "text" | "number" | "currency" | "percent";
  align?: "left" | "right" | "center";
}

export function ReportExportActions<TRow>({
  title,
  filename,
  rows,
  columns,
}: {
  title: string;
  filename: string;
  rows: TRow[];
  columns: ReportColumn<TRow>[];
}) {
  const disabled = rows.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
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
        title="Exporta um .xls compatível com Excel, mantendo números como números."
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
    </div>
  );
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
) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; }
    h1 { font-size: 18pt; margin-bottom: 4px; }
    p { color: #64748b; font-size: 10pt; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1d4ed8; color: #ffffff; font-weight: bold; text-align: left; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 10pt; }
    td.text { mso-number-format: "\\@"; }
    td.number { mso-number-format: "0.00"; }
    td.currency { mso-number-format: "\\"R$\\" #,##0.00"; }
    td.percent { mso-number-format: "0.0"; }
    .right { text-align: right; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Gerado em ${escapeHtml(generatedAt)} · BRQ Delivery Coverage Hub</p>
  <table>
    <thead>
      <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `<tr>${columns.map((column) => formatExcelCell(column, row)).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;

  downloadBlob(html, `${filename}.xls`, "application/vnd.ms-excel;charset=utf-8");
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

function formatExcelCell<TRow>(column: ReportColumn<TRow>, row: TRow) {
  const value = column.value(row);
  const format = column.format ?? "text";
  const alignClassName = column.align === "right" || format === "currency" || format === "number" || format === "percent"
    ? " right"
    : column.align === "center"
      ? " center"
      : "";

  if (value === null || value === undefined || value === "") {
    return `<td class="${format}${alignClassName}"></td>`;
  }

  if (format !== "text" && typeof value === "number") {
    return `<td class="${format}${alignClassName}">${Number.isFinite(value) ? value : 0}</td>`;
  }

  return `<td class="text${alignClassName}">${escapeHtml(sanitizeSpreadsheetText(String(value)))}</td>`;
}

function sanitizeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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
