"use client";

import Link from "next/link";
import { ArrowUpRight, Target, UserRound } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { SortableTableHead, type SortDirection, type SortState } from "@/components/shared/sortable-table-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeliveryStore } from "@/store/delivery-store";
import { useAccess } from "@/lib/access-context";
import { isHunterConsultAccess, normalizeAccessEmail } from "@/lib/access-control";
import { formatCurrency, toFileSlug } from "@/lib/utils";
import { isHunterRole, isSpecialistHunterRole, isTargetAssignableRole } from "@/lib/roles";
import type { RoleType } from "@/data/mockData";
import { isOtherDirectorId } from "@/lib/director-governance";

const currentYear = 2026;
const hunterOwnTotalLabel = "Meta Hunter atual";
const hunterStudioContainedLabel = "Meta herdada de Studios";
const hunterBaseWithoutStudioLabel = "Meta própria";

type ReportView = "people" | "areas" | "hunters" | "hunterClients" | "specialistHunters" | "directors";
type PeopleSortKey = "person" | "role" | "clients" | "hunter" | "renewal" | "total" | "status";
type AreaSortKey = "area" | "clients" | "hunter" | "maintenance" | "total";
type HunterSortKey = "hunter" | "role" | "ownHunter" | "studioHunter" | "totalHunter" | "studios";

export function PersonTargetReport() {
  const { accessUser, canEdit } = useAccess();
  const { areas, people, customers, targetAllocations, studioTargetAllocations, specialistHunterStudioAssignments } = useDeliveryStore();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [roleType, setRoleType] = useState("");
  const [view, setView] = useState<ReportView>("people");
  const [selectedDirectorId, setSelectedDirectorId] = useState("");
  const [selectedHunterClientId, setSelectedHunterClientId] = useState("");
  const [selectedHunterIds, setSelectedHunterIds] = useState<Set<string>>(new Set());
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [peopleSort, setPeopleSort] = useState<SortState<PeopleSortKey>>({ key: "total", direction: "desc" });
  const [areaSort, setAreaSort] = useState<SortState<AreaSortKey>>({ key: "total", direction: "desc" });
  const [hunterSort, setHunterSort] = useState<SortState<HunterSortKey>>({ key: "totalHunter", direction: "desc" });
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());

  const selectedYear = Number(year) || currentYear;
  const hunterConsultOnly = isHunterConsultAccess(accessUser);
  const accessEmail = accessUser?.email ?? "";
  const scopedHunterPerson = useMemo(() => {
    if (!hunterConsultOnly || !accessEmail) return null;
    const email = normalizeAccessEmail(accessEmail);
    return people.find((person) => person.email && normalizeAccessEmail(person.email) === email && isHunterRole(person.roleType)) ?? null;
  }, [accessEmail, hunterConsultOnly, people]);
  const effectiveView: ReportView = hunterConsultOnly ? "hunters" : view;
  const scopedHunterId = hunterConsultOnly ? scopedHunterPerson?.id ?? "" : "";
  const detailHunterIds = useMemo(
    () => hunterConsultOnly && scopedHunterId ? new Set([scopedHunterId]) : selectedHunterIds,
    [hunterConsultOnly, scopedHunterId, selectedHunterIds],
  );
  const assignablePeople = useMemo(
    () => people.filter((person) => person.active && isTargetAssignableRole(person.roleType)),
    [people],
  );
  const years = useMemo(
    () => Array.from(new Set([
      currentYear,
      ...targetAllocations.map((allocation) => allocation.year),
      ...studioTargetAllocations.map((allocation) => allocation.year),
    ])).sort((a, b) => b - a),
    [studioTargetAllocations, targetAllocations],
  );
  const customerNames = useMemo(() => new Map(customers.map((customer) => [customer.id, customer.name])), [customers]);
  const areaNames = useMemo(() => new Map(areas.map((area) => [area.id, area.name])), [areas]);
  const peopleNames = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);
  const directorOptions = useMemo(
    () => people
      .filter((person) => person.active && !isOtherDirectorId(person.id) && canConsolidateDirectorReport(person, people))
      .sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
    [people],
  );
  const peopleRows = useMemo(
    () => buildPeopleRows(assignablePeople, targetAllocations, studioTargetAllocations, customerNames, selectedYear),
    [assignablePeople, customerNames, selectedYear, studioTargetAllocations, targetAllocations],
  );
  const areaRows = useMemo(
    () => buildAreaStudioRows(areas, customers, studioTargetAllocations, selectedYear),
    [areas, customers, selectedYear, studioTargetAllocations],
  );
  const hunterRows = useMemo(
    () => buildHunterRows(people, targetAllocations, studioTargetAllocations, areaNames, selectedYear),
    [areaNames, people, selectedYear, studioTargetAllocations, targetAllocations],
  );
  const hunterClientRows = useMemo(
    () => buildHunterClientRows({
      people,
      allocations: targetAllocations,
      studioAllocations: studioTargetAllocations,
      customerNames,
      areaNames,
      hunterId: selectedHunterClientId,
      year: selectedYear,
    }),
    [areaNames, customerNames, people, selectedHunterClientId, selectedYear, studioTargetAllocations, targetAllocations],
  );
  const filteredPeopleRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortPeopleRows(peopleRows.filter((row) =>
      (!query || `${row.personName} ${row.roleType} ${row.customerNames.join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType)
    ), peopleSort);
  }, [peopleRows, peopleSort, roleType, search]);
  const filteredAreaRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortAreaRows(areaRows.filter((row) =>
      (!query || `${row.areaName} ${row.clients.map((client) => client.customerName).join(" ")}`.toLowerCase().includes(query))
    ), areaSort);
  }, [areaRows, areaSort, search]);
  const areaDetailRows = useMemo(
    () => buildAreaStudioDetailRows({
      allocations: studioTargetAllocations,
      customerNames,
      areaNames,
      peopleNames,
      areaIds: selectedAreaIds,
      year: selectedYear,
    }),
    [areaNames, customerNames, peopleNames, selectedAreaIds, selectedYear, studioTargetAllocations],
  );
  const filteredAreaDetailRows = useMemo(() => {
    const query = search.toLowerCase();
    return areaDetailRows.filter((row) =>
      !query || `${row.areaName} ${row.customerName} ${row.segment} ${row.hunterName}`.toLowerCase().includes(query)
    );
  }, [areaDetailRows, search]);
  const filteredHunterRows = useMemo(() => {
    const query = search.toLowerCase();
    return sortHunterRows(hunterRows.filter((row) =>
      (!query || `${row.hunterName} ${row.roleType} ${row.studioBreakdown.map((item) => item.areaName).join(" ")}`.toLowerCase().includes(query))
      && (!roleType || row.roleType === roleType)
    ), hunterSort);
  }, [hunterRows, hunterSort, roleType, search]);
  const hunterDetailRows = useMemo(
    () => buildHunterDetailRows({
      people,
      allocations: targetAllocations,
      studioAllocations: studioTargetAllocations,
      customerNames,
      areaNames,
      hunterIds: detailHunterIds,
      year: selectedYear,
    }),
    [areaNames, customerNames, detailHunterIds, people, selectedYear, studioTargetAllocations, targetAllocations],
  );
  const filteredHunterDetailRows = useMemo(() => {
    const query = search.toLowerCase();
    return hunterDetailRows.filter((row) =>
      !query || `${row.customerName} ${row.segment} ${row.areaName}`.toLowerCase().includes(query)
    );
  }, [hunterDetailRows, search]);
  const hunterDetailGroups = useMemo(() => buildHunterDetailGroups(filteredHunterDetailRows), [filteredHunterDetailRows]);
  const filteredHunterClientRows = useMemo(() => {
    const query = search.toLowerCase();
    return hunterClientRows.filter((row) =>
      !query || `${row.hunterName} ${row.customerName} ${row.areaName} ${row.segment}`.toLowerCase().includes(query)
    );
  }, [hunterClientRows, search]);
  const hunterClientGroups = useMemo(() => buildHunterClientGroups(filteredHunterClientRows), [filteredHunterClientRows]);
  const specialistHunterRows = useMemo(
    () => buildSpecialistHunterRows(people, customers, studioTargetAllocations, specialistHunterStudioAssignments, areaNames, selectedYear),
    [areaNames, customers, people, selectedYear, specialistHunterStudioAssignments, studioTargetAllocations],
  );
  const filteredSpecialistHunterRows = useMemo(() => {
    const query = search.toLowerCase();
    return specialistHunterRows.filter((row) =>
      !query || `${row.personName} ${row.customerName} ${row.areaName}`.toLowerCase().includes(query)
    );
  }, [search, specialistHunterRows]);
  const directorDetailRows = useMemo(
    () => buildDirectorDetailRows({
      people,
      allocations: targetAllocations,
      studioAllocations: studioTargetAllocations,
      customerNames,
      areaNames,
      peopleNames,
      directorId: selectedDirectorId,
      year: selectedYear,
    }),
    [areaNames, customerNames, people, peopleNames, selectedDirectorId, selectedYear, studioTargetAllocations, targetAllocations],
  );
  const filteredDirectorDetailRows = useMemo(() => {
    const query = search.toLowerCase();
    return directorDetailRows.filter((row) =>
      !query || `${row.personName} ${row.roleType} ${row.customerName} ${row.segment} ${row.areaName} ${row.studioHunterName}`.toLowerCase().includes(query)
    );
  }, [directorDetailRows, search]);
  const directorDetailGroups = useMemo(() => buildDirectorDetailGroups(filteredDirectorDetailRows), [filteredDirectorDetailRows]);
  const selectedPeopleRows = useMemo(
    () => filteredPeopleRows.filter((row) => selectedPersonIds.has(row.personId)),
    [filteredPeopleRows, selectedPersonIds],
  );
  const peopleExportRows = selectedPeopleRows.length ? selectedPeopleRows : filteredPeopleRows;
  const selectedAreaRows = useMemo(
    () => areaRows.filter((row) => selectedAreaIds.has(row.areaId)),
    [areaRows, selectedAreaIds],
  );
  const selectedHunterRows = useMemo(
    () => hunterRows.filter((row) => detailHunterIds.has(row.hunterId)),
    [detailHunterIds, hunterRows],
  );
  const hasSelectedAreas = selectedAreaIds.size > 0;
  const hasDetailHunters = detailHunterIds.size > 0;
  const singleSelectedAreaName = selectedAreaRows.length === 1 ? selectedAreaRows[0].areaName : "";
  const singleSelectedHunterName = selectedHunterRows.length === 1 ? selectedHunterRows[0].hunterName : "";
  const areaExportRows = hasSelectedAreas ? filteredAreaDetailRows : filteredAreaRows;
  const hunterExportRows = hasDetailHunters ? filteredHunterDetailRows : filteredHunterRows;
  const hunterSummaryRows = useMemo(
    () => hunterConsultOnly ? [] : filteredHunterRows,
    [filteredHunterRows, hunterConsultOnly],
  );
  const peopleExportFilename = useMemo(() => {
    const singlePersonName = peopleExportRows.length === 1 ? peopleExportRows[0].personName : "";
    return `relatorio-pessoas-metas-${year}${singlePersonName ? `-${toFileSlug(singlePersonName)}` : selectedPeopleRows.length ? "-selecao" : ""}`;
  }, [peopleExportRows, selectedPeopleRows.length, year]);
  const currentOfficialRows = useMemo(
    () => buildOfficialRowsForView({
      view: effectiveView,
      peopleRows: peopleExportRows,
      hunterRows: hunterSummaryRows,
      hunterDetailRows: filteredHunterDetailRows,
      directorDetailRows: filteredDirectorDetailRows,
      areaRows: filteredAreaRows,
      areaDetailRows: filteredAreaDetailRows,
      selectedHunterNames: selectedHunterRows.map((row) => row.hunterName),
      selectedAreaNames: selectedAreaRows.map((row) => row.areaName),
      year: selectedYear,
    }),
    [effectiveView, filteredAreaDetailRows, filteredAreaRows, filteredDirectorDetailRows, filteredHunterDetailRows, hunterSummaryRows, peopleExportRows, selectedAreaRows, selectedHunterRows, selectedYear],
  );
  const officialFilenameSuffix = getOfficialFilenameSuffix({
    view: effectiveView,
    peopleRows: peopleExportRows,
    selectedHunterNames: selectedHunterRows.map((row) => row.hunterName),
    selectedAreaNames: selectedAreaRows.map((row) => row.areaName),
    selectedHunterClientName: selectedHunterClientId ? peopleNames.get(selectedHunterClientId) ?? "" : "",
    selectedDirectorName: selectedDirectorId ? peopleNames.get(selectedDirectorId) ?? "" : "",
  });
  const officialCustomExports = [{
    label: "Planilha oficial",
    title: "Executivo e Cliente (R$) - FINANCIAL",
    filename: `FINANCIAL-Rateio-Metas-AEs-${year}${officialFilenameSuffix}`,
    worksheetName: "Resumo_Cliente",
    rows: currentOfficialRows as unknown[],
    columns: officialReportColumns as ReportColumn<unknown>[],
    rowStyle: (row: unknown) => (row as OfficialTargetRow).rowStyle,
  }];
  const allVisiblePeopleSelected = filteredPeopleRows.length > 0 && selectedPeopleRows.length === filteredPeopleRows.length;
  const allVisibleAreasSelected = filteredAreaRows.length > 0 && filteredAreaRows.every((row) => selectedAreaIds.has(row.areaId));
  const allVisibleHuntersSelected = filteredHunterRows.length > 0 && filteredHunterRows.every((row) => selectedHunterIds.has(row.hunterId));
  const activeRows = effectiveView === "people"
    ? filteredPeopleRows
    : effectiveView === "areas"
      ? hasSelectedAreas ? filteredAreaDetailRows : filteredAreaRows
      : effectiveView === "hunters"
        ? hasDetailHunters ? filteredHunterDetailRows : hunterSummaryRows
        : effectiveView === "hunterClients"
          ? filteredHunterClientRows
          : effectiveView === "specialistHunters"
            ? filteredSpecialistHunterRows
            : filteredDirectorDetailRows;
  const totals = useMemo(
    () => getViewTotals(effectiveView, filteredPeopleRows, filteredAreaRows, hunterSummaryRows, filteredDirectorDetailRows, filteredHunterDetailRows, hasDetailHunters, hasSelectedAreas ? filteredAreaDetailRows : undefined, filteredSpecialistHunterRows, filteredHunterClientRows),
    [effectiveView, filteredAreaDetailRows, filteredAreaRows, hunterSummaryRows, filteredDirectorDetailRows, filteredHunterDetailRows, filteredHunterClientRows, filteredPeopleRows, filteredSpecialistHunterRows, hasDetailHunters, hasSelectedAreas],
  );
  const roleTypes = useMemo(() => Array.from(new Set(assignablePeople.map((person) => person.roleType))).sort((a, b) => a.localeCompare(b, "pt-BR")), [assignablePeople]);

  function changeView(nextView: ReportView) {
    setView(nextView);
    setRoleType("");
    setSelectedDirectorId("");
    setSelectedHunterClientId("");
    setSelectedHunterIds(new Set());
    setSelectedAreaIds(new Set());
    setSelectedPersonIds(new Set());
  }

  function togglePersonSelection(personId: string) {
    setSelectedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }

  function selectVisiblePeople() {
    setSelectedPersonIds(new Set(filteredPeopleRows.map((row) => row.personId)));
  }

  function clearSelectedPeople() {
    setSelectedPersonIds(new Set());
  }

  function toggleAreaSelection(areaId: string) {
    setSelectedAreaIds((current) => {
      const next = new Set(current);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  }

  function selectVisibleAreas() {
    setSelectedAreaIds(new Set(filteredAreaRows.map((row) => row.areaId)));
  }

  function clearSelectedAreas() {
    setSelectedAreaIds(new Set());
  }

  function toggleHunterSelection(hunterId: string) {
    setSelectedHunterIds((current) => {
      const next = new Set(current);
      if (next.has(hunterId)) {
        next.delete(hunterId);
      } else {
        next.add(hunterId);
      }
      return next;
    });
  }

  function selectVisibleHunters() {
    setSelectedHunterIds(new Set(filteredHunterRows.map((row) => row.hunterId)));
  }

  function clearSelectedHunters() {
    setSelectedHunterIds(new Set());
  }

  return (
    <>
      <PageHeader
        eyebrow="BU Financial"
        title="Relatório de Metas"
        description="Escolha a visão de análise, abra o detalhe quando necessário e exporte em Excel ou no modelo oficial Financial."
        actions={(
          <div className="flex flex-wrap gap-2">
            {effectiveView === "people" && (
              <ReportExportActions
                title={`Relatório de Pessoas e Metas · ${year}${selectedPeopleRows.length ? " · Seleção" : ""}`}
                filename={peopleExportFilename}
                rows={peopleExportRows}
                columns={peopleReportColumns}
                customExports={officialCustomExports}
              />
            )}
            {effectiveView === "areas" && hasSelectedAreas && (
              <ReportExportActions
                title={`Relatório detalhado por Área/Studio · ${singleSelectedAreaName || `${selectedAreaIds.size} selecionados`} · ${year}`}
                filename={`relatorio-area-studio-detalhado-${year}${singleSelectedAreaName ? `-${toFileSlug(singleSelectedAreaName)}` : "-selecao"}`}
                rows={areaExportRows as AreaStudioDetailRow[]}
                columns={areaDetailReportColumns}
                customExports={officialCustomExports}
              />
            )}
            {effectiveView === "areas" && !hasSelectedAreas && (
              <ReportExportActions
                title={`Relatório por Área/Studio · ${year}`}
                filename={`relatorio-area-studio-${year}`}
                rows={areaExportRows as AreaStudioRow[]}
                columns={areaReportColumns}
                customExports={officialCustomExports}
              />
            )}
            {effectiveView === "hunters" && !hasDetailHunters && !hunterConsultOnly && (
              <ReportExportActions
                title={`Relatório por Hunter · ${year}`}
                filename={`relatorio-hunter-${year}`}
                rows={hunterExportRows as HunterRow[]}
                columns={hunterReportColumns}
                customExports={officialCustomExports}
              />
            )}
            {effectiveView === "hunters" && hasDetailHunters && (
              <ReportExportActions
                title={`Relatório detalhado do Hunter · ${singleSelectedHunterName || `${detailHunterIds.size} selecionados`} · ${year}`}
                filename={`relatorio-hunter-detalhado-${year}${singleSelectedHunterName ? `-${toFileSlug(singleSelectedHunterName)}` : "-selecao"}`}
                rows={hunterExportRows as HunterDetailRow[]}
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
              />
            )}
            {effectiveView === "specialistHunters" && (
              <ReportExportActions
                title={`Relatório de Hunter Especializado · ${year}`}
                filename={`relatorio-hunter-especializado-${year}`}
                rows={filteredSpecialistHunterRows}
                columns={specialistHunterReportColumns}
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
            {canEdit && !hunterConsultOnly && <Button asChild><Link href="/metas-pessoas"><Target className="h-4 w-4" /> Ajustar metas</Link></Button>}
          </div>
        )}
      />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiSummaryCard label={totals.countLabel} value={totals.count} />
        <KpiSummaryCard label={totals.firstLabel} {...(effectiveView === "specialistHunters" ? { value: totals.first } : { currencyValue: totals.first })} />
        <KpiSummaryCard label={totals.secondLabel} {...(effectiveView === "specialistHunters" ? { value: totals.second } : { currencyValue: totals.second })} />
        <KpiSummaryCard label={totals.totalLabel} currencyValue={totals.total} />
      </section>

      {!hunterConsultOnly && <Card className="mb-5 p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "people", label: "Pessoas" },
              { key: "areas", label: "Áreas / Studios" },
              { key: "hunters", label: "Hunters" },
              { key: "hunterClients", label: "Hunter x Clientes" },
              { key: "specialistHunters", label: "Hunters Especializados" },
              { key: "directors", label: "Diretoria Delivery" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  view === item.key
                    ? "bg-brq-purple text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => changeView(item.key as ReportView)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">{getViewDescription(effectiveView)}</p>
        </div>
      </Card>}

      <FilterBar search={search} onSearchChange={setSearch}>
        <Select value={year} onChange={(event) => setYear(event.target.value)}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        {effectiveView !== "areas" && effectiveView !== "specialistHunters" && !hunterConsultOnly && (
          effectiveView === "directors" ? (
            <Select value={selectedDirectorId} onChange={(event) => setSelectedDirectorId(event.target.value)}>
              <option value="">Escolha a diretoria</option>
              {directorOptions.map((director) => <option key={director.id} value={director.id}>{director.name}</option>)}
            </Select>
          ) : effectiveView === "hunterClients" ? (
            <Select value={selectedHunterClientId} onChange={(event) => setSelectedHunterClientId(event.target.value)}>
              <option value="">Escolha o Hunter</option>
              {[...hunterRows]
                .sort((first, second) => first.hunterName.localeCompare(second.hunterName, "pt-BR"))
                .map((hunter) => <option key={hunter.hunterId} value={hunter.hunterId}>{hunter.hunterName}</option>)}
            </Select>
          ) : (
            <Select value={roleType} onChange={(event) => setRoleType(event.target.value)}>
              <option value="">Todos os perfis</option>
              {roleTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          )
        )}
      </FilterBar>

      {hunterConsultOnly && !scopedHunterPerson && (
        <Card className="mb-5 p-4 shadow-sm">
          <EmptyState message="Seu e-mail de acesso ainda não está vinculado a uma pessoa Hunter ativa." />
        </Card>
      )}

      {effectiveView === "people" && (
        <Card className="mb-5 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedPeopleRows.length
                  ? `${selectedPeopleRows.length} pessoa(s) selecionada(s) para exportação.`
                  : "Sem seleção ativa: a exportação usa a lista filtrada."}
              </p>
              <p className="text-xs text-slate-500">
                Marque pessoas na grade para exportar apenas uma seleção.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={selectVisiblePeople} disabled={!filteredPeopleRows.length}>
                Selecionar visíveis
              </Button>
              <Button type="button" variant="outline" onClick={clearSelectedPeople} disabled={!selectedPersonIds.size}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </Card>
      )}

      {effectiveView === "areas" && !hunterConsultOnly && (
        <Card className="mb-5 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedAreaIds.size
                  ? `${selectedAreaIds.size} área/studio(s) selecionado(s). Exportação e prévia usam o detalhe explodido.`
                  : "Sem seleção ativa: a exportação usa o consolidado filtrado."}
              </p>
              <p className="text-xs text-slate-500">
                Marque áreas/studios na grade para exportar cliente, segmento, Hunter Studio e valor alocado.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={selectVisibleAreas} disabled={!filteredAreaRows.length}>
                Selecionar visíveis
              </Button>
              <Button type="button" variant="outline" onClick={clearSelectedAreas} disabled={!selectedAreaIds.size}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </Card>
      )}

      {effectiveView === "hunters" && !hunterConsultOnly && (
        <Card className="mb-5 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedHunterIds.size
                  ? `${selectedHunterIds.size} hunter(s) selecionado(s). Exportação e prévia usam o detalhe explodido.`
                  : "Sem seleção ativa: a exportação usa o consolidado filtrado."}
              </p>
              <p className="text-xs text-slate-500">
                Marque Hunters na grade para exportar a composição por cliente, segmento e área/studio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={selectVisibleHunters} disabled={!filteredHunterRows.length}>
                Selecionar visíveis
              </Button>
              <Button type="button" variant="outline" onClick={clearSelectedHunters} disabled={!selectedHunterIds.size}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </Card>
      )}

      {effectiveView === "people" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                      aria-label="Selecionar pessoas visíveis para exportação"
                      checked={allVisiblePeopleSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          selectVisiblePeople();
                        } else {
                          clearSelectedPeople();
                        }
                      }}
                    />
                  </TableHead>
                  <SortableTableHead label="Pessoa" sortKey="person" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Perfil" sortKey="role" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Clientes" sortKey="clients" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Meta Hunter" sortKey="hunter" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Renovação + Ampliação" sortKey="renewal" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Meta Total" sortKey="total" sortState={peopleSort} onSort={setPeopleSort} />
                  <SortableTableHead label="Status" sortKey="status" sortState={peopleSort} onSort={setPeopleSort} />
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPeopleRows.map((row) => (
                  <TableRow
                    key={row.personId}
                    className="cursor-pointer"
                    title="Dê duplo clique para ajustar as metas da pessoa"
                    onDoubleClick={() => {
                      window.location.href = `/metas-pessoas?personId=${encodeURIComponent(row.personId)}&year=${encodeURIComponent(year)}`;
                    }}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                        aria-label={`Selecionar ${row.personName} para exportação`}
                        checked={selectedPersonIds.has(row.personId)}
                        onChange={() => togglePersonSelection(row.personId)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-purple-50 text-brq-purple">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{row.personName}</p>
                          <p className="text-xs text-slate-400">{row.email || "E-mail não informado"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{row.roleType}</Badge></TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{row.customerCount}</p>
                      <p className="max-w-md truncate text-xs text-slate-500">{row.customerNames.join(", ") || "Sem clientes com meta"}</p>
                    </TableCell>
                    <TableCell>{formatCurrency(row.hunter)}</TableCell>
                    <TableCell>{formatCurrency(row.farmerRenewal)}</TableCell>
                    <TableCell className="font-bold text-slate-950">{formatCurrency(row.total)}</TableCell>
                    <TableCell>{row.total > 0 ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Com meta</Badge> : <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Sem meta</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {canEdit && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/metas-pessoas?personId=${encodeURIComponent(row.personId)}&year=${encodeURIComponent(year)}`}>
                              Ajustar <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!activeRows.length && <EmptyState />}
        </Card>
      )}

      {effectiveView === "areas" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[1160px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                      aria-label="Selecionar áreas/studios visíveis para exportação detalhada"
                      checked={allVisibleAreasSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          selectVisibleAreas();
                        } else {
                          clearSelectedAreas();
                        }
                      }}
                    />
                  </TableHead>
                  <SortableTableHead label="Área / Studio" sortKey="area" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Clientes" sortKey="clients" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Studio Hunter" sortKey="hunter" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Studio Manutenção" sortKey="maintenance" sortState={areaSort} onSort={setAreaSort} />
                  <SortableTableHead label="Total" sortKey="total" sortState={areaSort} onSort={setAreaSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAreaRows.map((row) => (
                  <TableRow key={row.areaId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                        aria-label={`Selecionar ${row.areaName} para exportação detalhada`}
                        checked={selectedAreaIds.has(row.areaId)}
                        onChange={() => toggleAreaSelection(row.areaId)}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.areaName}</p>
                      <p className="text-xs text-slate-400">{row.clients.length} cliente(s)</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-2xl flex-wrap gap-2">
                        {row.clients.slice(0, 10).map((client) => (
                          <Badge key={client.customerId} variant="secondary" title={`Hunter: ${formatCurrency(client.hunter)} · Manutenção: ${formatCurrency(client.maintenance)}`}>
                            {client.customerName} · {formatCurrency(client.total)}
                          </Badge>
                        ))}
                        {row.clients.length > 10 && <Badge variant="secondary">+{row.clients.length - 10}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sky-700">{formatCurrency(row.hunter)}</TableCell>
                    <TableCell>{formatCurrency(row.maintenance)}</TableCell>
                    <TableCell className="font-bold text-slate-950">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!filteredAreaRows.length && <EmptyState message="Nenhuma meta de área/studio foi encontrada para o ano selecionado." />}
          {hasSelectedAreas && (
            <div className="border-t border-slate-200">
              <div className="px-5 py-4">
                <p className="text-sm font-bold text-slate-900">Detalhe explodido da seleção</p>
                <p className="text-xs text-slate-500">Esta é a mesma composição usada na prévia e na exportação.</p>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[1180px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Área / Studio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Hunter Studio</TableHead>
                      <TableHead className="text-right">Valor alocado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAreaDetailRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-bold text-slate-950">{row.areaName}</p>
                        </TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell>
                          <Badge className={row.segment === "Studio Hunter" ? "bg-sky-100 text-sky-800 hover:bg-sky-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                            {row.segment}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.hunterName || "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-slate-950">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredAreaDetailRows.length > 0 && (
                      <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                        <TableCell colSpan={4} className="font-bold">Total selecionado</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatCurrency(filteredAreaDetailRows.reduce((total, row) => total + row.amount, 0))}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {!filteredAreaDetailRows.length && <EmptyState message="Nenhuma quebra foi encontrada para a seleção atual." />}
            </div>
          )}
        </Card>
      )}

      {effectiveView === "hunters" && (
        <Card className="overflow-hidden shadow-sm">
          {!hunterConsultOnly && (
            <div className="overflow-x-auto">
              <Table className="min-w-[1040px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                        aria-label="Selecionar Hunters visíveis para exportação detalhada"
                        checked={allVisibleHuntersSelected}
                        onChange={(event) => {
                          if (event.target.checked) {
                            selectVisibleHunters();
                          } else {
                            clearSelectedHunters();
                          }
                        }}
                      />
                    </TableHead>
                    <SortableTableHead label="Hunter" sortKey="hunter" sortState={hunterSort} onSort={setHunterSort} />
                    <SortableTableHead label="Perfil" sortKey="role" sortState={hunterSort} onSort={setHunterSort} />
                    <SortableTableHead label={hunterOwnTotalLabel} sortKey="totalHunter" sortState={hunterSort} onSort={setHunterSort} />
                    <SortableTableHead label={hunterStudioContainedLabel} sortKey="studioHunter" sortState={hunterSort} onSort={setHunterSort} />
                    <TableHead className="text-right">{hunterBaseWithoutStudioLabel}</TableHead>
                    <SortableTableHead label="Abertura Studio" sortKey="studios" sortState={hunterSort} onSort={setHunterSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHunterRows.map((row) => (
                    <TableRow key={row.hunterId}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-brq-purple"
                          aria-label={`Selecionar ${row.hunterName} para exportação detalhada`}
                          checked={selectedHunterIds.has(row.hunterId)}
                          onChange={() => toggleHunterSelection(row.hunterId)}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-950">{row.hunterName}</p>
                        <p className="text-xs text-slate-400">{row.customerCount} cliente(s) na composição</p>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{row.roleType}</Badge></TableCell>
                      <TableCell className="font-bold text-slate-950">{formatCurrency(row.totalHunter)}</TableCell>
                      <TableCell className="text-sky-700">
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{formatCurrency(row.studioHunter)}</span>
                          <span className="text-[11px] font-medium text-sky-600">herdada dos Studios</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(getHunterBaseWithoutStudio(row))}</TableCell>
                      <TableCell>
                        <div className="flex max-w-xl flex-wrap gap-2">
                          {row.studioBreakdown.length === 0 && <span className="text-sm text-slate-400">Sem abertura Studio</span>}
                          {row.studioBreakdown.map((item) => (
                            <Badge key={item.areaId} className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                              {item.areaName} · {formatCurrency(item.amount)} herdado
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!hunterConsultOnly && !filteredHunterRows.length && <EmptyState message="Nenhuma meta Hunter foi encontrada para o ano selecionado." />}
          {hasDetailHunters && (
            <div className={hunterConsultOnly ? "" : "border-t border-slate-200"}>
              <div className="px-5 py-4">
                <p className="text-sm font-bold text-slate-900">Detalhe explodido da seleção</p>
                <p className="text-xs text-slate-500">A meta do Hunter é composta por Meta própria + Meta herdada de Studios. A herdada não deve ser lançada novamente como meta própria.</p>
              </div>
              <div className="overflow-x-auto">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Hunter</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Área / Studio</TableHead>
                    <TableHead className="text-right">Valor alocado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hunterDetailGroups.map((group) => (
                    <Fragment key={`${group.hunterName}-${group.customerName}`}>
                      <TableRow className="bg-slate-50">
                        <TableCell colSpan={4}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 break-words font-bold text-slate-950">{group.hunterName}</span>
                            <span className="min-w-0 break-words font-bold text-slate-950">{group.customerName}</span>
                            <span className="text-xs text-slate-500">{group.rows.length} linha(s)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-slate-950">
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{formatCurrency(group.total)}</span>
                            {group.studioHunterTotal > 0 && (
                              <span className="text-[11px] font-medium text-sky-700">
                                {formatCurrency(group.studioHunterTotal)} herdado de Studios
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.hunterName}</TableCell>
                          <TableCell>{row.customerName}</TableCell>
                          <TableCell>
                            {row.segment}
                            {isHunterStudioContainedSegment(row.segment) && <span className="ml-2 text-xs text-sky-700">(herdado)</span>}
                          </TableCell>
                          <TableCell>{row.areaName || "—"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-slate-950">{formatCurrency(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {filteredHunterDetailRows.length > 0 && (
                    <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                      <TableCell colSpan={4} className="font-bold">Total selecionado</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(summarizeHunterDetailTotals(filteredHunterDetailRows).total)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
              {!filteredHunterDetailRows.length && <EmptyState message="Nenhuma quebra foi encontrada para a seleção atual." />}
            </div>
          )}
        </Card>
      )}

      {effectiveView === "hunterClients" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-sm font-bold text-slate-900">Hunter x Clientes</p>
            <p className="text-xs text-slate-500">
              Escolha um Hunter para ver Meta própria, Studio Hunter e Studio Manutenção por cliente e área/studio. Manutenção aparece para leitura operacional e não soma na meta Hunter.
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Área / Studio</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Hunter efetivo</TableHead>
                  <TableHead className="text-right">Studio Hunter</TableHead>
                  <TableHead className="text-right">Manutenção</TableHead>
                  <TableHead className="text-right">Total da linha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hunterClientGroups.map((group) => (
                  <Fragment key={`${group.hunterId}-${group.customerName}`}>
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={4}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 break-words font-bold text-slate-950">{group.customerName}</span>
                          <Badge variant="secondary">{group.rows.length} quebra(s)</Badge>
                          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                            Studio Hunter {formatCurrency(group.hunterAmount)}
                          </Badge>
                          {group.maintenanceAmount > 0 && (
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                              Manutenção {formatCurrency(group.maintenanceAmount)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-sky-700">{formatCurrency(group.hunterAmount)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-slate-700">{formatCurrency(group.maintenanceAmount)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(group.total)}</TableCell>
                    </TableRow>
                    {group.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell />
                        <TableCell>
                          <p className="font-semibold text-slate-900">{row.areaName}</p>
                          {row.observations && <p className="max-w-xl text-xs text-slate-500">{row.observations}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge className={row.segment === "Meta própria Hunter" ? "bg-violet-100 text-violet-800 hover:bg-violet-100" : row.hunterAmount > 0 ? "bg-sky-100 text-sky-800 hover:bg-sky-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                            {row.segment}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.hunterName}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-sky-700">{formatCurrency(row.hunterAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.maintenanceAmount)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
                {filteredHunterClientRows.length > 0 && (
                  <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                    <TableCell colSpan={4} className="font-bold">Total do Hunter nos clientes filtrados</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(filteredHunterClientRows.reduce((total, row) => total + row.hunterAmount, 0))}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(filteredHunterClientRows.reduce((total, row) => total + row.maintenanceAmount, 0))}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(filteredHunterClientRows.reduce((total, row) => total + row.total, 0))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {!selectedHunterClientId && <EmptyState message="Escolha um Hunter para abrir os clientes, Studios e manutenções associados." />}
          {selectedHunterClientId && !filteredHunterClientRows.length && <EmptyState message="Nenhuma quebra foi encontrada para o Hunter e filtros selecionados." />}
        </Card>
      )}

      {effectiveView === "specialistHunters" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-sm font-bold text-slate-900">Metas gerenciais derivadas de Studios</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Hunter Especializado não tem meta própria e não altera totais oficiais. Os valores abaixo vêm da seleção gerencial de Studios.
              </p>
              {canEdit && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/metas-hunters-especializados">Ajustar seleção</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Hunter Especializado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Área / Studio</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor gerencial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpecialistHunterRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.personName}</p>
                      <p className="text-xs text-slate-500">cross / gerencial</p>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{row.areaName}</TableCell>
                    <TableCell><Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">{row.sourceLabel}</Badge></TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(row.amount)}</TableCell>
                  </TableRow>
                ))}
                {filteredSpecialistHunterRows.length > 0 && (
                  <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                    <TableCell colSpan={4} className="font-bold">Total gerencial</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(filteredSpecialistHunterRows.reduce((total, row) => total + row.amount, 0))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {!filteredSpecialistHunterRows.length && <EmptyState message="Nenhum Hunter Especializado possui seleção de Studios para o ano/filtro atual." />}
        </Card>
      )}

      {effectiveView === "directors" && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Área / Studio</TableHead>
                  <TableHead className="text-right">Valor da pessoa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directorDetailGroups.map((personGroup) => (
                  <Fragment key={personGroup.personId}>
                    <TableRow className="bg-slate-50">
                      <TableCell colSpan={4}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 break-words font-bold text-slate-950">{personGroup.personName}</span>
                          <Badge variant="secondary">{personGroup.roleType}</Badge>
                          <span className="text-xs text-slate-500">{personGroup.clients.length} cliente(s)</span>
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Manager/Farmer {formatCurrency(personGroup.managerFarmerTotal)}
                          </Badge>
                          {personGroup.hunterTotal > 0 && (
                            <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">
                              Hunter {formatCurrency(personGroup.hunterTotal)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(personGroup.total)}</TableCell>
                    </TableRow>
                    {personGroup.clients.map((clientGroup) => (
                      <Fragment key={`${personGroup.personId}-${clientGroup.customerId}`}>
                        <TableRow className="bg-white">
                          <TableCell />
                          <TableCell>
                            <p className="break-words font-semibold text-slate-900">{clientGroup.customerName}</p>
                            <p className="text-xs text-slate-400">{clientGroup.rows.length} quebra(s)</p>
                          </TableCell>
                          <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Subtotal da pessoa no cliente
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-slate-950">{formatCurrency(clientGroup.total)}</TableCell>
                        </TableRow>
                        {clientGroup.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell />
                            <TableCell />
                            <TableCell>{row.segment}</TableCell>
                            <TableCell>{row.areaName || "—"}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-slate-950">{formatCurrency(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
                {filteredDirectorDetailRows.length > 0 && (
                  <TableRow className="bg-slate-900 text-white hover:bg-slate-900">
                    <TableCell colSpan={4} className="font-bold">Total das pessoas da diretoria</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatCurrency(filteredDirectorDetailRows.reduce((total, row) => total + row.amount, 0))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {!selectedDirectorId && <EmptyState message="Escolha uma diretoria para abrir as metas das pessoas por cliente." />}
          {selectedDirectorId && !activeRows.length && <EmptyState message="Nenhuma meta foi encontrada para a diretoria e filtros selecionados." />}
        </Card>
      )}
    </>
  );
}

function getViewDescription(view: ReportView) {
  if (view === "areas") return "Metas agrupadas por Área/Studio, com clientes apenas como detalhe.";
  if (view === "hunters") return "Metas consolidadas por Hunter, sem repetir uma linha por cliente.";
  if (view === "hunterClients") return "Escolha um Hunter e abra cliente, Studio, Hunter, manutenção e total no maior detalhe.";
  if (view === "specialistHunters") return "Leitura gerencial cross derivada de Studios, sem meta própria e sem impacto nos totais oficiais.";
  if (view === "directors") return "Abra pessoa, cliente e quebras de studio da diretoria selecionada.";
  return "Metas operacionais por pessoa, com acesso rápido para ajuste.";
}

function canConsolidateDirectorReport(
  person: { id: string; roleType: RoleType },
  people: Array<{ id: string; directorId?: string }>,
) {
  return person.roleType === "Director" || people.some((candidate) => candidate.id !== person.id && candidate.directorId === person.id);
}

function buildPeopleRows(
  people: Array<{ id: string; name: string; email?: string; roleType: RoleType; directorId?: string; active: boolean; clientIds: string[] }>,
  allocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number }>,
  studioAllocations: Array<{ customerId: string; hunterPersonId?: string; year: number; hunterAmount: number }>,
  customerNames: Map<string, string>,
  year: number,
) {
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);
  return people.map((person) => {
    const personAllocations = allocations.filter((allocation) =>
      allocation.personId === person.id
      && allocation.year === year
      && allocation.type !== "studio"
    );
    const directHunter = personAllocations
      .filter((allocation) => allocation.type === "hunter")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const farmerRenewal = personAllocations
      .filter((allocation) => allocation.type === "farmer_renewal")
      .reduce((total, allocation) => total + allocation.amount, 0);
    const studioCustomerIds = Array.from(studioByHunterCustomer.keys())
      .filter((key) => key.startsWith(`${person.id}:`))
      .map((key) => key.slice(person.id.length + 1));
    const customerIds = Array.from(new Set([
      ...personAllocations.map((allocation) => allocation.customerId),
      ...studioCustomerIds,
    ]));
    const customerBreakdown = customerIds
      .map((customerId) => {
        const customerAllocations = personAllocations.filter((allocation) => allocation.customerId === customerId);
        const directCustomerHunter = customerAllocations
          .filter((allocation) => allocation.type === "hunter")
          .reduce((total, allocation) => total + allocation.amount, 0);
        const customerFarmerRenewal = customerAllocations
          .filter((allocation) => allocation.type === "farmer_renewal")
          .reduce((total, allocation) => total + allocation.amount, 0);
        const studioHunter = studioByHunterCustomer.get(`${person.id}:${customerId}`) ?? 0;
        const customerHunter = Math.max(directCustomerHunter, studioHunter);

        return {
          customerId,
          customerName: customerNames.get(customerId) ?? customerId,
          hunter: customerHunter,
          farmerRenewal: customerFarmerRenewal,
          total: customerHunter + customerFarmerRenewal,
        };
      })
      .sort((a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName, "pt-BR"));
    const names = customerBreakdown
      .filter((item) => item.total > 0)
      .map((item) => item.customerName)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const hunter = Math.max(
      directHunter,
      customerBreakdown.reduce((total, item) => total + item.hunter, 0),
    );

    return {
      personId: person.id,
      personName: person.name,
      email: person.email,
      roleType: person.roleType,
      directorId: person.directorId,
      customerCount: names.length,
      customerNames: names,
      hunter,
      farmerRenewal,
      total: hunter + farmerRenewal,
      customerBreakdown,
    };
  });
}

function buildDirectorDetailRows({
  people,
  allocations,
  studioAllocations,
  customerNames,
  areaNames,
  peopleNames,
  directorId,
  year,
}: {
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; directorId?: string; clientIds: string[] }>;
  allocations: Array<{ id: string; customerId: string; personId: string; type: string; year: number; amount: number }>;
  studioAllocations: Array<{ id: string; customerId: string; areaId: string; hunterPersonId?: string; year: number; hunterAmount: number; maintenanceAmount: number }>;
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  peopleNames: Map<string, string>;
  directorId: string;
  year: number;
}) {
  if (!directorId) return [];

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const directorPeople = people.filter((person) => person.directorId === directorId);
  const directorPersonIds = new Set(directorPeople.map((person) => person.id));
  const directAllocations = allocations.filter((allocation) =>
    allocation.year === year
    && allocation.amount > 0
    && allocation.type !== "studio"
    && directorPersonIds.has(allocation.personId)
    );
  const rows: DirectorDetailRow[] = [];

  directAllocations
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      if (!person) return;
      if (allocation.type === "hunter" && !isHunterRole(person.roleType)) return;

      rows.push({
        id: allocation.id,
        personId: allocation.personId,
        customerId: allocation.customerId,
        personName: person.name,
        roleType: person.roleType,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        segment: allocation.type === "hunter" ? "Meta Hunter" : "Renovação + Ampliação",
        areaName: "",
        studioHunterName: "",
        amount: allocation.amount,
      });
    });

  studioAllocations
    .filter((allocation) => {
      const targetPersonId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      return allocation.year === year
        && targetPersonId
        && directorPersonIds.has(targetPersonId)
        && allocation.hunterAmount > 0;
    })
    .forEach((allocation) => {
      const targetPersonId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      if (!targetPersonId) return;
      const person = peopleById.get(targetPersonId);
      if (!person || !isHunterRole(person.roleType)) return;

      const baseRow = {
        personId: targetPersonId,
        customerId: allocation.customerId,
        personName: person.name,
        roleType: person.roleType,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        studioHunterName: peopleNames.get(targetPersonId) ?? "Pessoa não encontrada",
      };

      rows.push({
        ...baseRow,
        id: `${allocation.id}-hunter`,
        segment: "Studio Hunter",
        amount: allocation.hunterAmount,
      });
    });

  return rows.sort((first, second) =>
    first.personName.localeCompare(second.personName, "pt-BR")
    || first.customerName.localeCompare(second.customerName, "pt-BR")
    || first.segment.localeCompare(second.segment, "pt-BR")
  );
}

function buildDirectorDetailGroups(rows: DirectorDetailRow[]) {
  const peopleGroups = new Map<string, DirectorDetailPersonGroup>();

  rows.forEach((row) => {
    const personGroup = peopleGroups.get(row.personId) ?? {
      personId: row.personId,
      personName: row.personName,
      roleType: row.roleType,
      clients: [],
      total: 0,
      managerFarmerTotal: 0,
      hunterTotal: 0,
    };
    const clientGroup = personGroup.clients.find((client) => client.customerId === row.customerId) ?? {
      customerId: row.customerId,
      customerName: row.customerName,
      rows: [],
      total: 0,
    };

    if (!personGroup.clients.some((client) => client.customerId === row.customerId)) {
      personGroup.clients.push(clientGroup);
    }

    clientGroup.rows.push(row);
    clientGroup.total += row.amount;
    personGroup.total += row.amount;
    if (row.segment === "Renovação + Ampliação") {
      personGroup.managerFarmerTotal += row.amount;
    }
    if (row.segment === "Meta Hunter" || row.segment === "Studio Hunter") {
      personGroup.hunterTotal += row.amount;
    }
    peopleGroups.set(row.personId, personGroup);
  });

  return Array.from(peopleGroups.values())
    .map((personGroup) => ({
      ...personGroup,
      clients: personGroup.clients
        .map((clientGroup) => ({
          ...clientGroup,
          rows: clientGroup.rows.sort((first, second) =>
            getDirectorSegmentSortValue(first.segment) - getDirectorSegmentSortValue(second.segment)
            || first.areaName.localeCompare(second.areaName, "pt-BR")
          ),
        }))
        .sort((first, second) => second.total - first.total || first.customerName.localeCompare(second.customerName, "pt-BR")),
    }))
    .sort((first, second) => second.total - first.total || first.personName.localeCompare(second.personName, "pt-BR"));
}

function getDirectorSegmentSortValue(segment: string) {
  if (segment === "Meta Hunter") return 0;
  if (segment === "Renovação + Ampliação") return 1;
  if (segment === "Studio Hunter") return 2;
  return 3;
}

function buildAreaStudioRows(
  areas: Array<{ id: string; name: string }>,
  customers: Array<{ id: string; name: string }>,
  allocations: Array<{ customerId: string; areaId: string; year: number; hunterAmount: number; maintenanceAmount: number }>,
  year: number,
) {
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const groups = new Map<string, AreaStudioRow>();

  allocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount + allocation.maintenanceAmount > 0)
    .forEach((allocation) => {
      const group = groups.get(allocation.areaId) ?? {
        areaId: allocation.areaId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        hunter: 0,
        maintenance: 0,
        total: 0,
        clients: [],
      };
      const client = group.clients.find((item) => item.customerId === allocation.customerId) ?? {
        customerId: allocation.customerId,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        hunter: 0,
        maintenance: 0,
        total: 0,
      };

      if (!group.clients.some((item) => item.customerId === allocation.customerId)) {
        group.clients.push(client);
      }
      client.hunter += allocation.hunterAmount;
      client.maintenance += allocation.maintenanceAmount;
      client.total = client.hunter + client.maintenance;
      group.hunter += allocation.hunterAmount;
      group.maintenance += allocation.maintenanceAmount;
      group.total = group.hunter + group.maintenance;
      groups.set(allocation.areaId, group);
    });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    clients: group.clients.sort((a, b) => b.total - a.total || a.customerName.localeCompare(b.customerName, "pt-BR")),
  }));
}

function buildAreaStudioDetailRows({
  allocations,
  customerNames,
  areaNames,
  peopleNames,
  areaIds,
  year,
}: {
  allocations: Array<{ id: string; customerId: string; areaId: string; hunterPersonId?: string; year: number; hunterAmount: number; maintenanceAmount: number }>;
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  peopleNames: Map<string, string>;
  areaIds: Set<string>;
  year: number;
}) {
  if (!areaIds.size) return [];

  const rows: AreaStudioDetailRow[] = [];
  allocations
    .filter((allocation) => allocation.year === year && areaIds.has(allocation.areaId) && allocation.hunterAmount + allocation.maintenanceAmount > 0)
    .forEach((allocation) => {
      const base = {
        areaId: allocation.areaId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        customerId: allocation.customerId,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        hunterName: allocation.hunterPersonId ? peopleNames.get(allocation.hunterPersonId) ?? "Pessoa não encontrada" : "",
      };
      if (allocation.hunterAmount > 0) {
        rows.push({
          ...base,
          id: `${allocation.id}-hunter`,
          segment: "Studio Hunter",
          amount: allocation.hunterAmount,
        });
      }
      if (allocation.maintenanceAmount > 0) {
        rows.push({
          ...base,
          id: `${allocation.id}-maintenance`,
          segment: "Studio Manutenção",
          amount: allocation.maintenanceAmount,
        });
      }
    });

  return rows.sort((first, second) =>
    first.customerName.localeCompare(second.customerName, "pt-BR")
    || first.segment.localeCompare(second.segment, "pt-BR")
  );
}

function buildHunterRows(
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  allocations: Array<{ customerId: string; personId: string; type: string; year: number; amount: number; ownAmount?: number }>,
  studioAllocations: Array<{ customerId: string; areaId: string; hunterPersonId?: string; year: number; hunterAmount: number }>,
  areaNames: Map<string, string>,
  year: number,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rows = new Map<string, HunterRow>();
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);

  studioAllocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount > 0 && getEffectiveStudioHunterPersonId(allocation, people, allocations))
    .forEach((allocation) => {
      const targetPersonId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      if (!targetPersonId) return;
      const person = peopleById.get(targetPersonId);
      const row = rows.get(targetPersonId) ?? {
        hunterId: targetPersonId,
        hunterName: person?.name ?? "Pessoa não encontrada",
        roleType: person?.roleType ?? "Hunter",
        ownHunter: 0,
        studioHunter: 0,
        totalHunter: 0,
        customerIds: new Set<string>(),
        customerCount: 0,
        studioBreakdown: [],
      } satisfies HunterRow;
      row.customerIds.add(allocation.customerId);
      const existing = row.studioBreakdown.find((item) => item.areaId === allocation.areaId);
      if (existing) {
        existing.amount += allocation.hunterAmount;
      } else {
        row.studioBreakdown.push({
          areaId: allocation.areaId,
          areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
          amount: allocation.hunterAmount,
        });
      }
      row.studioHunter += allocation.hunterAmount;
      row.totalHunter = getContainedHunterTotal(row.ownHunter, row.studioHunter);
      rows.set(targetPersonId, row);
    });

  allocations
    .filter((allocation) => allocation.year === year && allocation.type === "hunter" && allocation.amount > 0)
    .forEach((allocation) => {
      const person = peopleById.get(allocation.personId);
      const row = rows.get(allocation.personId) ?? {
        hunterId: allocation.personId,
        hunterName: person?.name ?? "Pessoa não encontrada",
        roleType: person?.roleType ?? "Hunter",
        ownHunter: 0,
        studioHunter: 0,
        totalHunter: 0,
        customerIds: new Set<string>(),
        customerCount: 0,
        studioBreakdown: [],
      } satisfies HunterRow;
      const studioHunterForCustomer = studioByHunterCustomer.get(`${allocation.personId}:${allocation.customerId}`) ?? 0;
      row.ownHunter += getHunterOwnAmount(allocation, studioHunterForCustomer);
      row.customerIds.add(allocation.customerId);
      row.totalHunter = getContainedHunterTotal(row.ownHunter, row.studioHunter);
      rows.set(allocation.personId, row);
    });

  return Array.from(rows.values()).map((row) => ({
    ...row,
    totalHunter: getContainedHunterTotal(row.ownHunter, row.studioHunter),
    customerCount: row.customerIds.size,
    studioBreakdown: row.studioBreakdown.sort((a, b) => b.amount - a.amount || a.areaName.localeCompare(b.areaName, "pt-BR")),
  }));
}

function buildStudioHunterTotalsByHunterCustomer(
  studioAllocations: Array<{ customerId: string; hunterPersonId?: string; year: number; hunterAmount: number }>,
  year: number,
  people: Array<{ id: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
) {
  const totals = new Map<string, number>();
  studioAllocations
    .filter((allocation) => allocation.year === year && allocation.hunterAmount > 0)
    .forEach((allocation) => {
      const effectiveHunterPersonId = getEffectiveStudioHunterPersonId(allocation, people, targetAllocations);
      if (!effectiveHunterPersonId) return;
      const key = `${effectiveHunterPersonId}:${allocation.customerId}`;
      totals.set(key, (totals.get(key) ?? 0) + allocation.hunterAmount);
    });
  return totals;
}

function getHunterOwnAmount(
  allocation: { amount: number; ownAmount?: number },
  studioHunterAmount: number,
) {
  return Math.max(allocation.ownAmount ?? allocation.amount - studioHunterAmount, 0);
}

function getEffectiveStudioHunterPersonId(
  allocation: { customerId: string; hunterPersonId?: string; year: number },
  people: Array<{ id: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
) {
  return allocation.hunterPersonId
    ?? getDefaultHunterPersonIdForCustomer(people, targetAllocations, allocation.customerId, allocation.year);
}

function getDefaultHunterPersonIdForCustomer(
  people: Array<{ id: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  targetAllocations: Array<{ customerId: string; personId: string; type: string; year: number }>,
  customerId: string,
  year: number,
) {
  const directHunterTarget = targetAllocations.find((allocation) =>
    allocation.customerId === customerId
    && allocation.year === year
    && allocation.type === "hunter"
    && people.some((person) => person.id === allocation.personId && person.active && isHunterRole(person.roleType))
  );
  if (directHunterTarget) return directHunterTarget.personId;

  return people.find((person) =>
    person.active
    && isHunterRole(person.roleType)
    && person.clientIds.includes(customerId)
  )?.id;
}

function buildHunterDetailRows({
  people,
  allocations,
  studioAllocations,
  customerNames,
  areaNames,
  hunterIds,
  year,
}: {
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; clientIds: string[] }>;
  allocations: Array<{ id: string; customerId: string; personId: string; type: string; year: number; amount: number; ownAmount?: number }>;
  studioAllocations: Array<{ id: string; customerId: string; areaId: string; hunterPersonId?: string; year: number; hunterAmount: number }>;
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  hunterIds: Set<string>;
  year: number;
}) {
  if (!hunterIds.size) return [];

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);
  const rows: HunterDetailRow[] = [];

  allocations
    .filter((allocation) =>
      allocation.year === year
      && hunterIds.has(allocation.personId)
      && allocation.type === "hunter"
      && allocation.amount > 0
    )
    .forEach((allocation) => {
      const hunter = peopleById.get(allocation.personId);
      const studioHunterForCustomer = studioByHunterCustomer.get(`${allocation.personId}:${allocation.customerId}`) ?? 0;
      const ownAmount = getHunterOwnAmount(allocation, studioHunterForCustomer);
      if (ownAmount <= 0.01) return;
      rows.push({
        id: allocation.id,
        hunterId: allocation.personId,
        hunterName: hunter?.name ?? "Hunter não encontrado",
        roleType: hunter?.roleType ?? "Hunter",
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        segment: hunterBaseWithoutStudioLabel,
        areaName: "",
        amount: ownAmount,
      });
    });

  studioAllocations
    .filter((allocation) => {
      const targetPersonId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      return allocation.year === year
        && targetPersonId
        && hunterIds.has(targetPersonId)
        && allocation.hunterAmount > 0;
    })
    .forEach((allocation) => {
      const targetPersonId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      if (!targetPersonId) return;
      const hunter = peopleById.get(targetPersonId);
      rows.push({
        id: `${allocation.id}-studio-hunter`,
        hunterId: targetPersonId,
        hunterName: hunter?.name ?? "Hunter não encontrado",
        roleType: hunter?.roleType ?? "Hunter",
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        segment: hunterStudioContainedLabel,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        amount: allocation.hunterAmount,
      });
    });

  return rows.sort((first, second) =>
    first.customerName.localeCompare(second.customerName, "pt-BR")
    || first.segment.localeCompare(second.segment, "pt-BR")
    || first.areaName.localeCompare(second.areaName, "pt-BR")
  );
}

function buildHunterDetailGroups(rows: HunterDetailRow[]) {
  const groups = new Map<string, HunterDetailGroup>();

  rows.forEach((row) => {
    const groupKey = `${row.hunterId}:${row.customerName}`;
    const group = groups.get(groupKey) ?? {
      hunterName: row.hunterName,
      customerName: row.customerName,
      rows: [],
      ownTotal: 0,
      studioHunterTotal: 0,
      total: 0,
    };
    group.rows.push(row);
    if (isHunterStudioContainedSegment(row.segment)) {
      group.studioHunterTotal += row.amount;
    } else if (isHunterOwnSegment(row.segment)) {
      group.ownTotal += row.amount;
    }
    group.total = getContainedHunterTotal(group.ownTotal, group.studioHunterTotal);
    groups.set(groupKey, group);
  });

  return Array.from(groups.values()).sort((first, second) =>
    first.hunterName.localeCompare(second.hunterName, "pt-BR")
    || second.total - first.total
    || first.customerName.localeCompare(second.customerName, "pt-BR")
  );
}

function buildHunterClientRows({
  people,
  allocations,
  studioAllocations,
  customerNames,
  areaNames,
  hunterId,
  year,
}: {
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; clientIds: string[] }>;
  allocations: Array<{ id: string; customerId: string; personId: string; type: string; year: number; amount: number; ownAmount?: number }>;
  studioAllocations: Array<{ id: string; customerId: string; areaId: string; hunterPersonId?: string; year: number; hunterAmount: number; maintenanceAmount: number; notes?: string }>;
  customerNames: Map<string, string>;
  areaNames: Map<string, string>;
  hunterId: string;
  year: number;
}) {
  if (!hunterId) return [];

  const peopleById = new Map(people.map((person) => [person.id, person]));
  const hunter = peopleById.get(hunterId);
  const hunterName = hunter?.name ?? "Hunter não encontrado";
  const studioByHunterCustomer = buildStudioHunterTotalsByHunterCustomer(studioAllocations, year, people, allocations);
  const rows: HunterClientRow[] = [];

  allocations
    .filter((allocation) =>
      allocation.year === year
      && allocation.personId === hunterId
      && allocation.type === "hunter"
      && allocation.amount > 0
    )
    .forEach((allocation) => {
      const studioHunterForCustomer = studioByHunterCustomer.get(`${hunterId}:${allocation.customerId}`) ?? 0;
      const ownAmount = getHunterOwnAmount(allocation, studioHunterForCustomer);
      if (ownAmount <= 0.01) return;

      rows.push({
        id: allocation.id,
        hunterId,
        hunterName,
        customerId: allocation.customerId,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        areaName: hunterBaseWithoutStudioLabel,
        segment: "Meta própria Hunter",
        hunterAmount: ownAmount,
        maintenanceAmount: 0,
        total: ownAmount,
        observations: "",
      });
    });

  studioAllocations
    .filter((allocation) => {
      const effectiveHunterId = getEffectiveStudioHunterPersonId(allocation, people, allocations);
      return allocation.year === year
        && effectiveHunterId === hunterId
        && allocation.hunterAmount + allocation.maintenanceAmount > 0;
    })
    .forEach((allocation) => {
      rows.push({
        id: allocation.id,
        hunterId,
        hunterName,
        customerId: allocation.customerId,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        segment: getStudioTargetTypeLabel(allocation.hunterAmount, allocation.maintenanceAmount),
        hunterAmount: allocation.hunterAmount,
        maintenanceAmount: allocation.maintenanceAmount,
        total: allocation.hunterAmount + allocation.maintenanceAmount,
        observations: allocation.notes ?? "",
      });
    });

  return rows.sort((first, second) =>
    first.customerName.localeCompare(second.customerName, "pt-BR")
    || getHunterClientSegmentSortValue(first.segment) - getHunterClientSegmentSortValue(second.segment)
    || first.areaName.localeCompare(second.areaName, "pt-BR")
  );
}

function buildHunterClientGroups(rows: HunterClientRow[]) {
  const groups = new Map<string, HunterClientGroup>();

  rows.forEach((row) => {
    const group = groups.get(row.customerId) ?? {
      hunterId: row.hunterId,
      hunterName: row.hunterName,
      customerId: row.customerId,
      customerName: row.customerName,
      rows: [],
      hunterAmount: 0,
      maintenanceAmount: 0,
      total: 0,
    };
    group.rows.push(row);
    group.hunterAmount += row.hunterAmount;
    group.maintenanceAmount += row.maintenanceAmount;
    group.total += row.total;
    groups.set(row.customerId, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: group.rows.sort((first, second) =>
        getHunterClientSegmentSortValue(first.segment) - getHunterClientSegmentSortValue(second.segment)
        || first.areaName.localeCompare(second.areaName, "pt-BR")
      ),
    }))
    .sort((first, second) => first.customerName.localeCompare(second.customerName, "pt-BR"));
}

function getHunterClientSegmentSortValue(segment: string) {
  if (segment === "Meta própria Hunter") return 0;
  if (segment.includes("Studio Hunter")) return 1;
  return 2;
}

function buildSpecialistHunterRows(
  people: Array<{ id: string; name: string; roleType: RoleType; active: boolean; clientIds: string[] }>,
  customers: Array<{ id: string; name: string }>,
  studioAllocations: Array<{
    id: string;
    customerId: string;
    areaId: string;
    year: number;
    hunterAmount: number;
    maintenanceAmount: number;
  }>,
  assignments: Array<{
    personId: string;
    studioTargetAllocationId: string;
    year: number;
  }>,
  areaNames: Map<string, string>,
  year: number,
) {
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const studioById = new Map(studioAllocations.map((allocation) => [allocation.id, allocation]));
  const rows: SpecialistHunterRow[] = [];

  assignments
    .filter((assignment) => assignment.year === year)
    .forEach((assignment) => {
      const person = peopleById.get(assignment.personId);
      const allocation = studioById.get(assignment.studioTargetAllocationId);
      if (!person?.active || !isSpecialistHunterRole(person.roleType) || !allocation) return;
      if (allocation.year !== year || allocation.hunterAmount + allocation.maintenanceAmount <= 0) return;

      rows.push({
        id: `${person.id}-${assignment.studioTargetAllocationId}`,
        personId: person.id,
        personName: person.name,
        customerName: customerNames.get(allocation.customerId) ?? allocation.customerId,
        areaName: areaNames.get(allocation.areaId) ?? allocation.areaId,
        sourceLabel: getSpecialistHunterSourceLabel(allocation.hunterAmount, allocation.maintenanceAmount),
        amount: allocation.hunterAmount + allocation.maintenanceAmount,
        year,
      });
    });

  return rows.sort((first, second) =>
    first.personName.localeCompare(second.personName, "pt-BR")
    || first.customerName.localeCompare(second.customerName, "pt-BR")
    || first.areaName.localeCompare(second.areaName, "pt-BR")
  );
}

function getViewTotals(
  view: ReportView,
  peopleRows: PeopleRow[],
  areaRows: AreaStudioRow[],
  hunterRows: HunterRow[],
  directorDetailRows: DirectorDetailRow[],
  hunterDetailRows: HunterDetailRow[],
  hasSelectedHunter: boolean,
  areaDetailRows?: AreaStudioDetailRow[],
  specialistHunterRows: SpecialistHunterRow[] = [],
  hunterClientRows: HunterClientRow[] = [],
) {
  if (view === "areas") {
    if (areaDetailRows) {
      return areaDetailRows.reduce((summary, row) => ({
        ...summary,
        countLabel: "Quebras do Studio",
        count: summary.count + 1,
        firstLabel: "Studio Hunter",
        first: summary.first + (row.segment === "Studio Hunter" ? row.amount : 0),
        secondLabel: "Studio Manutenção",
        second: summary.second + (row.segment === "Studio Manutenção" ? row.amount : 0),
        total: summary.total + row.amount,
      }), emptyTotals("Quebras do Studio", "Studio Hunter", "Studio Manutenção"));
    }
    return areaRows.reduce((summary, row) => ({
      ...summary,
      countLabel: "Áreas/Studios com meta",
      count: summary.count + 1,
      firstLabel: "Studio Hunter",
      first: summary.first + row.hunter,
      secondLabel: "Studio Manutenção",
      second: summary.second + row.maintenance,
      total: summary.total + row.total,
    }), emptyTotals("Áreas/Studios com meta", "Studio Hunter", "Studio Manutenção"));
  }
  if (view === "hunters") {
    if (hasSelectedHunter) {
      const hunterTotals = summarizeHunterDetailTotals(hunterDetailRows);
      return {
        ...emptyTotals("Quebras do Hunter", hunterOwnTotalLabel, hunterStudioContainedLabel, "Meta Hunter total"),
        count: hunterDetailRows.length,
        first: hunterTotals.ownTotal,
        second: hunterTotals.studioHunterTotal,
        total: hunterTotals.total,
      };
    }
    return hunterRows.reduce((summary, row) => ({
      ...summary,
      countLabel: "Hunters com meta",
      count: summary.count + 1,
      firstLabel: hunterBaseWithoutStudioLabel,
      first: summary.first + getHunterBaseWithoutStudio(row),
      secondLabel: hunterStudioContainedLabel,
      second: summary.second + row.studioHunter,
      total: summary.total + row.totalHunter,
  }), emptyTotals("Hunters com meta", hunterBaseWithoutStudioLabel, hunterStudioContainedLabel, hunterOwnTotalLabel));
  }
  if (view === "specialistHunters") {
    const peopleIds = new Set(specialistHunterRows.map((row) => row.personId));
    const customerNames = new Set(specialistHunterRows.map((row) => row.customerName));
    const areaNames = new Set(specialistHunterRows.map((row) => row.areaName));
    return {
      ...emptyTotals("Hunters Especializados", "Clientes", "Studios", "Total gerencial"),
      count: peopleIds.size,
      first: customerNames.size,
      second: areaNames.size,
      total: specialistHunterRows.reduce((total, row) => total + row.amount, 0),
    };
  }
  if (view === "hunterClients") {
    const customerIds = new Set(hunterClientRows.map((row) => row.customerId));
    return hunterClientRows.reduce((summary, row) => ({
      ...summary,
      countLabel: "Clientes do Hunter",
      count: customerIds.size,
      firstLabel: "Studio Hunter",
      first: summary.first + row.hunterAmount,
      secondLabel: "Manutenção",
      second: summary.second + row.maintenanceAmount,
      totalLabel: "Total detalhado",
      total: summary.total + row.total,
    }), emptyTotals("Clientes do Hunter", "Studio Hunter", "Manutenção", "Total detalhado"));
  }
  if (view === "directors") {
    const personIds = new Set(directorDetailRows.map((row) => row.personId));
    return directorDetailRows.reduce((summary, row) => ({
      ...summary,
      countLabel: "Pessoas com meta",
      count: personIds.size,
      firstLabel: "Manager/Farmer",
      first: summary.first + (row.segment === "Renovação + Ampliação" ? row.amount : 0),
      secondLabel: "Hunter",
      second: summary.second + (row.segment === "Meta Hunter" || row.segment === "Studio Hunter" ? row.amount : 0),
      total: summary.total + row.amount,
      totalLabel: "Total das pessoas",
    }), emptyTotals("Pessoas com meta", "Manager/Farmer", "Hunter", "Total das pessoas"));
  }
  return peopleRows.reduce((summary, row) => ({
    ...summary,
    countLabel: "Pessoas com meta",
    count: summary.count + (row.total > 0 ? 1 : 0),
    firstLabel: "Meta Hunter",
    first: summary.first + row.hunter,
    secondLabel: "Renovação + Ampliação",
    second: summary.second + row.farmerRenewal,
    total: summary.total + row.total,
  }), emptyTotals("Pessoas com meta", "Meta Hunter", "Renovação + Ampliação"));
}

function emptyTotals(countLabel: string, firstLabel: string, secondLabel: string, totalLabel = "Total") {
  return { countLabel, count: 0, firstLabel, first: 0, secondLabel, second: 0, totalLabel, total: 0 };
}

function getContainedHunterTotal(ownTotal: number, studioHunterTotal: number) {
  return ownTotal + studioHunterTotal;
}

function getHunterBaseWithoutStudio(row: HunterRow) {
  return Math.max(row.totalHunter - row.studioHunter, 0);
}

function isHunterOwnSegment(segment: string) {
  return segment === hunterBaseWithoutStudioLabel || segment === hunterOwnTotalLabel || segment === "Hunter próprio";
}

function isHunterStudioContainedSegment(segment: string) {
  return segment === hunterStudioContainedLabel || segment === "Studio Hunter";
}

function summarizeHunterDetailTotals(rows: HunterDetailRow[]) {
  type HunterContainedTotals = { ownTotal: number; studioHunterTotal: number; total: number };
  const byHunterAndCustomer = new Map<string, { ownTotal: number; studioHunterTotal: number }>();

  rows.forEach((row) => {
    const key = `${row.hunterId}:${row.customerName}`;
    const current = byHunterAndCustomer.get(key) ?? { ownTotal: 0, studioHunterTotal: 0 };
    if (isHunterOwnSegment(row.segment)) {
      current.ownTotal += row.amount;
    } else if (isHunterStudioContainedSegment(row.segment)) {
      current.studioHunterTotal += row.amount;
    }
    byHunterAndCustomer.set(key, current);
  });

  return Array.from(byHunterAndCustomer.values()).reduce<HunterContainedTotals>((summary, item) => ({
    ownTotal: summary.ownTotal + item.ownTotal,
    studioHunterTotal: summary.studioHunterTotal + item.studioHunterTotal,
    total: summary.total + getContainedHunterTotal(item.ownTotal, item.studioHunterTotal),
  }), { ownTotal: 0, studioHunterTotal: 0, total: 0 });
}

const peopleReportColumns: ReportColumn<PeopleRow>[] = [
  { key: "personName", label: "Pessoa", value: (row) => row.personName },
  { key: "email", label: "E-mail", value: (row) => row.email ?? "" },
  { key: "roleType", label: "Perfil", value: (row) => row.roleType },
  { key: "customerCount", label: "Qtd. clientes", value: (row) => row.customerCount, format: "number", align: "right" },
  { key: "customerNames", label: "Clientes", value: (row) => row.customerNames.join(", ") },
  { key: "hunter", label: "Meta Hunter", value: (row) => row.hunter, format: "currency", align: "right" },
  { key: "farmerRenewal", label: "Renovação + Ampliação", value: (row) => row.farmerRenewal, format: "currency", align: "right" },
  { key: "total", label: "Meta Total", value: (row) => row.total, format: "currency", align: "right" },
];

const areaReportColumns: ReportColumn<AreaStudioRow>[] = [
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "targetType", label: "Tipo de meta", value: (row) => getStudioTargetTypeLabel(row.hunter, row.maintenance) },
  { key: "clientCount", label: "Qtd. clientes", value: (row) => row.clients.length, format: "number", align: "right" },
  { key: "clients", label: "Clientes", value: (row) => row.clients.map((client) => `${client.customerName} (${getStudioTargetTypeLabel(client.hunter, client.maintenance)}): ${formatCurrency(client.total)}`).join(" | ") },
  { key: "hunter", label: "Studio Hunter", value: (row) => row.hunter, format: "currency", align: "right" },
  { key: "maintenance", label: "Studio Manutenção", value: (row) => row.maintenance, format: "currency", align: "right" },
  { key: "total", label: "Total", value: (row) => row.total, format: "currency", align: "right" },
];

const areaDetailReportColumns: ReportColumn<AreaStudioDetailRow>[] = [
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "customerName", label: "Cliente", value: (row) => row.customerName },
  { key: "segment", label: "Tipo de meta", value: (row) => row.segment },
  { key: "hunterName", label: "Hunter Studio", value: (row) => row.hunterName },
  { key: "amount", label: "Valor alocado", value: (row) => row.amount, format: "currency", align: "right" },
];

const hunterReportColumns: ReportColumn<HunterRow>[] = [
  { key: "hunterName", label: "Hunter", value: (row) => row.hunterName },
  { key: "roleType", label: "Perfil", value: (row) => row.roleType },
  { key: "customerCount", label: "Qtd. clientes", value: (row) => row.customerCount, format: "number", align: "right" },
  { key: "totalHunter", label: hunterOwnTotalLabel, value: (row) => row.totalHunter, format: "currency", align: "right" },
  { key: "studioHunter", label: hunterStudioContainedLabel, value: (row) => row.studioHunter, format: "currency", align: "right" },
  { key: "baseWithoutStudio", label: hunterBaseWithoutStudioLabel, value: (row) => getHunterBaseWithoutStudio(row), format: "currency", align: "right" },
  { key: "studioBreakdown", label: "Meta herdada por Studio", value: (row) => row.studioBreakdown.map((item) => `${item.areaName}: ${formatCurrency(item.amount)} herdado`).join(" | ") },
];

const hunterDetailReportColumns: ReportColumn<HunterDetailRow>[] = [
  { key: "hunterName", label: "Hunter", value: (row) => row.hunterName },
  { key: "roleType", label: "Perfil", value: (row) => row.roleType },
  { key: "customerName", label: "Cliente", value: (row) => row.customerName },
  { key: "segment", label: "Segmento", value: (row) => row.segment },
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "amount", label: "Valor alocado", value: (row) => row.amount, format: "currency", align: "right" },
];

const hunterClientReportColumns: ReportColumn<HunterClientRow>[] = [
  { key: "hunterName", label: "Hunter", value: (row) => row.hunterName },
  { key: "customerName", label: "Cliente", value: (row) => row.customerName },
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "segment", label: "Origem", value: (row) => row.segment },
  { key: "hunterAmount", label: "Studio Hunter", value: (row) => row.hunterAmount, format: "currency", align: "right" },
  { key: "maintenanceAmount", label: "Manutenção", value: (row) => row.maintenanceAmount, format: "currency", align: "right" },
  { key: "total", label: "Total da linha", value: (row) => row.total, format: "currency", align: "right" },
  { key: "observations", label: "Observações", value: (row) => row.observations },
];

const specialistHunterReportColumns: ReportColumn<SpecialistHunterRow>[] = [
  { key: "personName", label: "Hunter Especializado", value: (row) => row.personName },
  { key: "customerName", label: "Cliente", value: (row) => row.customerName },
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "sourceLabel", label: "Origem", value: (row) => row.sourceLabel },
  { key: "amount", label: "Valor gerencial", value: (row) => row.amount, format: "currency", align: "right" },
  { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
];

const directorDetailReportColumns: ReportColumn<DirectorDetailRow>[] = [
  { key: "personName", label: "Pessoa", value: (row) => row.personName },
  { key: "roleType", label: "Perfil", value: (row) => row.roleType },
  { key: "customerName", label: "Cliente", value: (row) => row.customerName },
  { key: "segment", label: "Segmento", value: (row) => row.segment },
  { key: "areaName", label: "Área / Studio", value: (row) => row.areaName },
  { key: "amount", label: "Valor da pessoa", value: (row) => row.amount, format: "currency", align: "right" },
];

const officialReportColumns: ReportColumn<OfficialTargetRow>[] = [
  { key: "executive", label: "Executivo", value: (row) => row.executive },
  { key: "customerName", label: "Grupo Cliente", value: (row) => row.customerName },
  { key: "totalTarget", label: "Meta 2026", value: (row) => row.totalTarget, format: "currency", align: "right" },
  { key: "farmerRenewal", label: "Renovação (FARMER)", value: (row) => row.farmerRenewal, format: "currency", align: "right" },
  { key: "hunter", label: "Novo (HUNTER)", value: (row) => row.hunter, format: "currency", align: "right" },
  { key: "hunterShare", label: "% Novo", value: (row) => row.hunterShare, format: "percent", align: "right" },
];

function buildOfficialRowsForView({
  view,
  peopleRows,
  hunterRows,
  hunterDetailRows,
  directorDetailRows,
  areaRows,
  areaDetailRows,
  selectedHunterNames,
  selectedAreaNames,
}: {
  view: ReportView;
  peopleRows: PeopleRow[];
  hunterRows: HunterRow[];
  hunterDetailRows: HunterDetailRow[];
  directorDetailRows: DirectorDetailRow[];
  areaRows: AreaStudioRow[];
  areaDetailRows: AreaStudioDetailRow[];
  selectedHunterNames: string[];
  selectedAreaNames: string[];
  year: number;
}) {
  if (view === "hunters") {
    if (selectedHunterNames.length) {
      return buildOfficialGroupedRows(buildOfficialHunterItemsFromDetails(hunterDetailRows));
    }
    return buildOfficialGroupedRows(hunterRows.map((row) => ({
      executive: row.hunterName,
      customerName: hunterOwnTotalLabel,
      farmerRenewal: 0,
      hunter: row.totalHunter,
    })));
  }

  if (view === "directors") {
    return buildOfficialGroupedRows(directorDetailRows.map((row) => ({
      executive: row.personName,
      customerName: row.customerName,
      farmerRenewal: row.segment === "Renovação + Ampliação" ? row.amount : 0,
      hunter: row.segment === "Meta Hunter" || row.segment === "Studio Hunter" ? row.amount : 0,
    })));
  }

  if (view === "areas") {
    if (selectedAreaNames.length) {
      return buildOfficialGroupedRows(areaDetailRows.map((row) => ({
        executive: row.areaName,
        customerName: row.customerName,
        farmerRenewal: row.segment === "Studio Manutenção" ? row.amount : 0,
        hunter: row.segment === "Studio Hunter" ? row.amount : 0,
      })));
    }
    return buildOfficialGroupedRows(areaRows.flatMap((row) => row.clients.map((client) => ({
      executive: row.areaName,
      customerName: client.customerName,
      farmerRenewal: client.maintenance,
      hunter: client.hunter,
    }))));
  }

  return buildOfficialGroupedRows(peopleRows.flatMap((row) => row.customerBreakdown.map((client) => ({
    executive: row.personName,
    customerName: client.customerName,
    farmerRenewal: client.farmerRenewal,
    hunter: client.hunter,
  }))));
}

function buildOfficialGroupedRows(items: Array<{ executive: string; customerName: string; farmerRenewal: number; hunter: number }>) {
  const byExecutive = new Map<string, Map<string, { farmerRenewal: number; hunter: number }>>();
  items
    .filter((item) => item.farmerRenewal + item.hunter > 0)
    .forEach((item) => {
      const customerMap = byExecutive.get(item.executive) ?? new Map<string, { farmerRenewal: number; hunter: number }>();
      const current = customerMap.get(item.customerName) ?? { farmerRenewal: 0, hunter: 0 };
      current.farmerRenewal += item.farmerRenewal;
      current.hunter += item.hunter;
      customerMap.set(item.customerName, current);
      byExecutive.set(item.executive, customerMap);
    });

  const rows: OfficialTargetRow[] = [];
  Array.from(byExecutive.entries())
    .sort(([first], [second]) => first.localeCompare(second, "pt-BR"))
    .forEach(([executive, customerMap]) => {
      let executiveFarmer = 0;
      let executiveHunter = 0;
      Array.from(customerMap.entries())
        .sort(([first], [second]) => first.localeCompare(second, "pt-BR"))
        .forEach(([customerName, amounts]) => {
          executiveFarmer += amounts.farmerRenewal;
          executiveHunter += amounts.hunter;
          rows.push(makeOfficialRow({
            executive,
            customerName,
            farmerRenewal: amounts.farmerRenewal,
            hunter: amounts.hunter,
            rowStyle: "regular",
          }));
        });
      rows.push(makeOfficialRow({
        executive,
        customerName: "Subtotal (na meta)",
        farmerRenewal: executiveFarmer,
        hunter: executiveHunter,
        rowStyle: "subtotal",
      }));
    });

  const totalFarmer = rows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.farmerRenewal, 0);
  const totalHunter = rows.filter((row) => row.rowStyle === "subtotal").reduce((total, row) => total + row.hunter, 0);
  if (rows.length) {
    rows.push(makeOfficialRow({
      executive: "TOTAL GERAL (na meta)",
      customerName: "",
      farmerRenewal: totalFarmer,
      hunter: totalHunter,
      rowStyle: "total",
    }));
  }
  return rows;
}

function buildOfficialHunterItemsFromDetails(rows: HunterDetailRow[]) {
  const byHunterAndCustomer = new Map<string, {
    executive: string;
    customerName: string;
    ownTotal: number;
    studioHunterTotal: number;
  }>();

  rows.forEach((row) => {
    const key = `${row.hunterId}:${row.customerName}`;
    const current = byHunterAndCustomer.get(key) ?? {
      executive: row.hunterName,
      customerName: row.customerName,
      ownTotal: 0,
      studioHunterTotal: 0,
    };
    if (isHunterOwnSegment(row.segment)) {
      current.ownTotal += row.amount;
    } else if (isHunterStudioContainedSegment(row.segment)) {
      current.studioHunterTotal += row.amount;
    }
    byHunterAndCustomer.set(key, current);
  });

  return Array.from(byHunterAndCustomer.values()).map((item) => ({
    executive: item.executive,
    customerName: item.customerName,
    farmerRenewal: 0,
    hunter: getContainedHunterTotal(item.ownTotal, item.studioHunterTotal),
  }));
}

function makeOfficialRow({
  executive,
  customerName,
  farmerRenewal,
  hunter,
  rowStyle,
}: {
  executive: string;
  customerName: string;
  farmerRenewal: number;
  hunter: number;
  rowStyle: "regular" | "subtotal" | "total";
}): OfficialTargetRow {
  const totalTarget = farmerRenewal + hunter;
  return {
    executive,
    customerName,
    totalTarget,
    farmerRenewal,
    hunter,
    hunterShare: totalTarget > 0 ? hunter / totalTarget : 0,
    rowStyle,
  };
}

function getOfficialFilenameSuffix({
  view,
  peopleRows,
  selectedHunterNames,
  selectedAreaNames,
  selectedHunterClientName,
  selectedDirectorName,
}: {
  view: ReportView;
  peopleRows: PeopleRow[];
  selectedHunterNames: string[];
  selectedAreaNames: string[];
  selectedHunterClientName: string;
  selectedDirectorName: string;
}) {
  if (view === "people" && peopleRows.length === 1) return `-${toFileSlug(peopleRows[0].personName)}`;
  if (view === "hunters" && selectedHunterNames.length === 1) return `-${toFileSlug(selectedHunterNames[0])}`;
  if (view === "hunters" && selectedHunterNames.length > 1) return "-selecao";
  if (view === "hunterClients" && selectedHunterClientName) return `-${toFileSlug(selectedHunterClientName)}`;
  if (view === "areas" && selectedAreaNames.length === 1) return `-${toFileSlug(selectedAreaNames[0])}`;
  if (view === "areas" && selectedAreaNames.length > 1) return "-selecao";
  if (view === "directors" && selectedDirectorName) return `-${toFileSlug(selectedDirectorName)}`;
  return "";
}

function getStudioTargetTypeLabel(hunter: number, maintenance: number) {
  if (hunter > 0.01 && maintenance > 0.01) return "Studio Hunter + Renovação/Manutenção";
  if (hunter > 0.01) return "Studio Hunter";
  if (maintenance > 0.01) return "Renovação/Manutenção";
  return "Sem valor";
}

function getSpecialistHunterSourceLabel(hunterAmount: number, maintenanceAmount: number) {
  if (hunterAmount > 0.01 && maintenanceAmount > 0.01) return "Studio total";
  if (hunterAmount > 0.01) return "Studio Hunter";
  return "Studio Manutenção";
}

function sortPeopleRows(rows: PeopleRow[], sortState: SortState<PeopleSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "person") return compareText(first.personName, second.personName);
    if (sortState.key === "role") return compareText(first.roleType, second.roleType);
    if (sortState.key === "clients") return compareNumber(first.customerCount, second.customerCount);
    if (sortState.key === "hunter") return compareNumber(first.hunter, second.hunter);
    if (sortState.key === "renewal") return compareNumber(first.farmerRenewal, second.farmerRenewal);
    if (sortState.key === "status") return compareNumber(first.total > 0 ? 1 : 0, second.total > 0 ? 1 : 0);
    return compareNumber(first.total, second.total);
  });
}

function sortAreaRows(rows: AreaStudioRow[], sortState: SortState<AreaSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "area") return compareText(first.areaName, second.areaName);
    if (sortState.key === "clients") return compareNumber(first.clients.length, second.clients.length);
    if (sortState.key === "hunter") return compareNumber(first.hunter, second.hunter);
    if (sortState.key === "maintenance") return compareNumber(first.maintenance, second.maintenance);
    return compareNumber(first.total, second.total);
  });
}

function sortHunterRows(rows: HunterRow[], sortState: SortState<HunterSortKey>) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    if (sortState.key === "hunter") return compareText(first.hunterName, second.hunterName);
    if (sortState.key === "role") return compareText(first.roleType, second.roleType);
    if (sortState.key === "ownHunter") return compareNumber(first.ownHunter, second.ownHunter);
    if (sortState.key === "studioHunter") return compareNumber(first.studioHunter, second.studioHunter);
    if (sortState.key === "studios") return compareText(first.studioBreakdown.map((item) => item.areaName).join(", "), second.studioBreakdown.map((item) => item.areaName).join(", "));
    return compareNumber(first.totalHunter, second.totalHunter);
  });
}

function sortRows<T>(rows: T[], direction: SortDirection, compare: (first: T, second: T) => number) {
  return [...rows].sort((first, second) => {
    const result = compare(first, second);
    return direction === "asc" ? result : -result;
  });
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "pt-BR", { sensitivity: "base", numeric: true });
}

function compareNumber(first: number, second: number) {
  return first - second;
}

type PeopleRow = ReturnType<typeof buildPeopleRows>[number];
type AreaStudioRow = {
  areaId: string;
  areaName: string;
  hunter: number;
  maintenance: number;
  total: number;
  clients: Array<{
    customerId: string;
    customerName: string;
    hunter: number;
    maintenance: number;
    total: number;
  }>;
};
type AreaStudioDetailRow = {
  id: string;
  areaId: string;
  areaName: string;
  customerId: string;
  customerName: string;
  segment: "Studio Hunter" | "Studio Manutenção";
  hunterName: string;
  amount: number;
};
type HunterRow = {
  hunterId: string;
  hunterName: string;
  roleType: RoleType | "Hunter";
  ownHunter: number;
  studioHunter: number;
  totalHunter: number;
  customerIds: Set<string>;
  customerCount: number;
  studioBreakdown: Array<{ areaId: string; areaName: string; amount: number }>;
};
type HunterDetailRow = {
  id: string;
  hunterId: string;
  hunterName: string;
  roleType: RoleType | "Hunter";
  customerName: string;
  segment: string;
  areaName: string;
  amount: number;
};
type HunterDetailGroup = {
  hunterName: string;
  customerName: string;
  rows: HunterDetailRow[];
  ownTotal: number;
  studioHunterTotal: number;
  total: number;
};
type HunterClientRow = {
  id: string;
  hunterId: string;
  hunterName: string;
  customerId: string;
  customerName: string;
  areaName: string;
  segment: string;
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
  observations: string;
};
type HunterClientGroup = {
  hunterId: string;
  hunterName: string;
  customerId: string;
  customerName: string;
  rows: HunterClientRow[];
  hunterAmount: number;
  maintenanceAmount: number;
  total: number;
};
type SpecialistHunterRow = {
  id: string;
  personId: string;
  personName: string;
  customerName: string;
  areaName: string;
  sourceLabel: string;
  amount: number;
  year: number;
};
type DirectorDetailRow = {
  id: string;
  personId: string;
  customerId: string;
  personName: string;
  roleType: RoleType;
  customerName: string;
  segment: string;
  areaName: string;
  studioHunterName: string;
  amount: number;
};
type DirectorDetailClientGroup = {
  customerId: string;
  customerName: string;
  rows: DirectorDetailRow[];
  total: number;
};
type DirectorDetailPersonGroup = {
  personId: string;
  personName: string;
  roleType: RoleType;
  clients: DirectorDetailClientGroup[];
  total: number;
  managerFarmerTotal: number;
  hunterTotal: number;
};
type OfficialTargetRow = {
  executive: string;
  customerName: string;
  totalTarget: number;
  farmerRenewal: number;
  hunter: number;
  hunterShare: number;
  rowStyle: "regular" | "subtotal" | "total";
};
