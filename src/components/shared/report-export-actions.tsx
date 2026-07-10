"use client";

import { Eye, FileSpreadsheet, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  exportCustomReport,
  exportRowsAsCsv,
  exportRowsAsExcel,
  type ReportCellValue,
  type ReportColumn,
  type ReportCustomExport,
} from "@/lib/report-export";
import { formatCurrency } from "@/lib/utils";

export type { ReportCellValue, ReportColumn, ReportCustomExport, ReportRowStyle } from "@/lib/report-export";

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
  const availableCustomExports = useMemo(
    () => customExports.filter((item) => item.rows.length > 0),
    [customExports],
  );

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
          <CustomExportButton key={`${customExport.label}-${customExport.filename}`} customExport={customExport} />
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
            {availableCustomExports.map((customExport) => (
              <CustomExportButton key={`preview-${customExport.label}-${customExport.filename}`} customExport={customExport} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CustomExportButton({ customExport }: { customExport: ReportCustomExport }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => exportCustomReport(customExport)}
      title={customExport.officialLayout ? "Exporta no modelo oficial Financial." : undefined}
    >
      <FileSpreadsheet className="h-4 w-4" />
      {customExport.label}
    </Button>
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
