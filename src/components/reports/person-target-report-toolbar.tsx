"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ReportExportActions,
  type ReportColumn,
  type ReportCustomExport,
} from "@/components/shared/report-export-actions";
import { toFileSlug } from "@/lib/utils";

export interface PersonTargetReportToolbarProps {
  effectiveView: string;
  year: string | number;
  canEdit: boolean;
  hunterConsultOnly: boolean;
  peopleExportRows: unknown[];
  peopleReportColumns: ReportColumn<unknown>[];
  officialCustomExports: ReportCustomExport[];
  selectedPeopleRowsLength: number;
  peopleExportFilename: string;
  selectedPeopleClientPersonName: string;
  filteredPeopleClientRows: unknown[];
  peopleClientReportColumns: ReportColumn<unknown>[];
  hasSelectedAreas: boolean;
  singleSelectedAreaName: string;
  selectedAreaIdsSize: number;
  areaExportRows: unknown[];
  areaDetailReportColumns: ReportColumn<unknown>[];
  areaReportColumns: ReportColumn<unknown>[];
  selectedDirectorId: string;
  peopleNames: Map<string, string>;
  filteredDirectorDetailRows: unknown[];
  directorDetailReportColumns: ReportColumn<unknown>[];
  hasDetailHunters: boolean;
  singleSelectedHunterName: string;
  detailHunterIdsSize: number;
  hunterExportRows: unknown[];
  hunterReportColumns: ReportColumn<unknown>[];
  hunterDetailReportColumns: ReportColumn<unknown>[];
  selectedHunterClientId: string;
  filteredHunterClientRows: unknown[];
  hunterClientReportColumns: ReportColumn<unknown>[];
  showClientCoverageValues: boolean;
  filteredClientCoverageRows: unknown[];
  clientCoverageExportColumns: ReportColumn<unknown>[];
  filteredSpecialistHunterRows: unknown[];
  specialistHunterReportColumns: ReportColumn<unknown>[];
}

export function PersonTargetReportToolbar({
  effectiveView,
  year,
  canEdit,
  hunterConsultOnly,
  peopleExportRows,
  peopleReportColumns,
  officialCustomExports,
  selectedPeopleRowsLength,
  peopleExportFilename,
  selectedPeopleClientPersonName,
  filteredPeopleClientRows,
  peopleClientReportColumns,
  hasSelectedAreas,
  singleSelectedAreaName,
  selectedAreaIdsSize,
  areaExportRows,
  areaDetailReportColumns,
  areaReportColumns,
  selectedDirectorId,
  peopleNames,
  filteredDirectorDetailRows,
  directorDetailReportColumns,
  hasDetailHunters,
  singleSelectedHunterName,
  detailHunterIdsSize,
  hunterExportRows,
  hunterReportColumns,
  hunterDetailReportColumns,
  selectedHunterClientId,
  filteredHunterClientRows,
  hunterClientReportColumns,
  showClientCoverageValues,
  filteredClientCoverageRows,
  clientCoverageExportColumns,
  filteredSpecialistHunterRows,
  specialistHunterReportColumns,
}: PersonTargetReportToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {effectiveView === "people" && (
        <ReportExportActions
          title={`Relatório de Pessoas e Metas · ${year}${selectedPeopleRowsLength ? " · Seleção" : ""}`}
          filename={peopleExportFilename}
          rows={peopleExportRows}
          columns={peopleReportColumns}
          customExports={officialCustomExports}
        />
      )}

      {effectiveView === "peopleClients" && (
        <ReportExportActions
          title={`Relatório Pessoas x Clientes · ${selectedPeopleClientPersonName || "Pessoa"} · ${year}`}
          filename={`relatorio-pessoas-clientes-${year}${selectedPeopleClientPersonName ? `-${toFileSlug(selectedPeopleClientPersonName)}` : ""}`}
          rows={filteredPeopleClientRows}
          columns={peopleClientReportColumns}
        />
      )}
      {effectiveView === "areas" && hasSelectedAreas && (
        <ReportExportActions
          title={`Relatório detalhado por Área/Studio · ${singleSelectedAreaName || `${selectedAreaIdsSize} selecionados`} · ${year}`}
          filename={`relatorio-area-studio-detalhado-${year}${singleSelectedAreaName ? `-${toFileSlug(singleSelectedAreaName)}` : "-selecao"}`}
          rows={areaExportRows}
          columns={areaDetailReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {effectiveView === "areas" && !hasSelectedAreas && (
        <ReportExportActions
          title={`Relatório por Área/Studio · ${year}`}
          filename={`relatorio-area-studio-${year}`}
          rows={areaExportRows}
          columns={areaReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {effectiveView === "hunters" && !hasDetailHunters && !hunterConsultOnly && (
        <ReportExportActions
          title={`Relatório por Hunter · ${year}`}
          filename={`relatorio-hunter-${year}`}
          rows={hunterExportRows}
          columns={hunterReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {effectiveView === "hunters" && hasDetailHunters && (
        <ReportExportActions
          title={`Relatório detalhado do Hunter · ${singleSelectedHunterName || `${detailHunterIdsSize} selecionados`} · ${year}`}
          filename={`relatorio-hunter-detalhado-${year}${singleSelectedHunterName ? `-${toFileSlug(singleSelectedHunterName)}` : "-selecao"}`}
          rows={hunterExportRows}
          columns={hunterDetailReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {effectiveView === "hunterClients" && (
        <ReportExportActions
          title={`Relatório Hunter x Clientes · ${selectedHunterClientId ? peopleNames.get(selectedHunterClientId) ?? "Hunter" : "Hunter"} · ${year}`}
          filename={`relatorio-hunter-clientes-${year}${selectedHunterClientId ? `-${toFileSlug(peopleNames.get(selectedHunterClientId) ?? "hunter")}` : ""}`}
          rows={filteredHunterClientRows}
          columns={hunterClientReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {effectiveView === "clients" && (
        <ReportExportActions
          title={`Relatório Clientes x Hunters x Delivery · ${year}${showClientCoverageValues ? "" : " · sem valores"}`}
          filename={`relatorio-clientes-hunters-delivery-${showClientCoverageValues ? "com-valores" : "sem-valores"}-${year}`}
          rows={filteredClientCoverageRows}
          columns={clientCoverageExportColumns}
        />
      )}
      {effectiveView === "specialistHunters" && (
        <ReportExportActions
          title={`Relatório de Hunter Especializado · ${year}`}
          filename={`relatorio-hunter-especializado-${year}`}
          rows={filteredSpecialistHunterRows}
          columns={specialistHunterReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {effectiveView === "directors" && (
        <ReportExportActions
          title={`Relatório por Diretoria Delivery · ${peopleNames.get(selectedDirectorId) ?? "Diretoria"} · ${year}`}
          filename={`relatorio-diretoria-delivery-${year}${selectedDirectorId ? `-${toFileSlug(peopleNames.get(selectedDirectorId) ?? "diretoria")}` : ""}`}
          rows={filteredDirectorDetailRows}
          columns={directorDetailReportColumns}
          customExports={officialCustomExports}
        />
      )}
      {canEdit && !hunterConsultOnly && (
        <Button asChild>
          <Link href="/metas-pessoas">
            <Target className="h-4 w-4" /> Ajustar metas
          </Link>
        </Button>
      )}
    </div>
  );
}
