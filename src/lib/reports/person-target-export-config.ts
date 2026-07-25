import type { OfficialTargetRow, ReportView } from "@/lib/reports/person-target-official-export";
import type { ReportColumn, ReportCustomExport, ReportRowStyle } from "@/lib/report-export";

export function buildOfficialExportConfig({
  view,
  year,
  officialRows,
  officialFilenameSuffix,
  officialReportColumns,
}: {
  view: ReportView;
  year: number;
  officialRows: unknown[];
  officialFilenameSuffix: string;
  officialReportColumns: ReportColumn<unknown>[];
}): ReportCustomExport {
  const isSpecialist = view === "specialistHunters";
  const label = "Planilha oficial";
  const title = isSpecialist ? "Hunter Especializado (R$) - FINANCIAL" : "Executivo e Cliente (R$) - FINANCIAL";
  const filename = isSpecialist
    ? `FINANCIAL-Hunters-Especializados-${year}${officialFilenameSuffix}`
    : `FINANCIAL-Rateio-Metas-AEs-${year}${officialFilenameSuffix}`;

  return {
    label,
    title,
    filename,
    worksheetName: "Resumo_Cliente",
    rows: officialRows,
    columns: officialReportColumns,
    rowStyle: (row: unknown): ReportRowStyle => (row as OfficialTargetRow).rowStyle,
    officialLayout: true,
  };
}
