"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, FileSearch, RefreshCw } from "lucide-react";
import type { Customer } from "@/data/mockData";
import type { BoardTargetBaselineRow } from "@/data/boardTargetBaseline";
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
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { useDeliveryStore } from "@/store/delivery-store";
import { useAccess } from "@/lib/access-context";
import { getCustomerTotalTargetFromParts } from "@/lib/customer-target-total";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import { buildHunterAccessScope } from "@/lib/hunter-access-scope";
import { getCustomerAllocationComposition, getCustomerTargetBreakdown } from "@/lib/customers/customer-coverage-view-model";
import {
  buildBoardTargetComparisonRows,
  getBoardComparisonStatusLabel,
  getRegisteredTargetTotals,
  type BaselineComparisonMode,
} from "@/lib/board-target-baseline";
import {
  applyCurveBaselineToStudioComparisons,
  refreshStudioBaselineComparisonsFromCurrentData,
  studioBaselineSources,
  type StudioBaselineSnapshot,
  type StudioBaselineComparisonRow,
  type StudioBaselineSourceCode,
} from "@/lib/studio-baseline-import";
import {
  buildStudioBaselineReportRows,
  restoreStudioBaselineComparisonRows,
  type StudioBaselineReportRow,
} from "@/lib/studio-baseline-report";
import { cn, formatCurrency, normalizeBusinessName } from "@/lib/utils";

type ComparisonRow = ReturnType<typeof buildBoardTargetComparisonRows>[number];
type BoardComparisonRow = ComparisonRow & {
  allocatedPeopleHunterTarget: number;
  allocatedPeopleFarmerRenewalTarget: number;
  allocatedPeopleTotalTarget: number;
  peopleDelta: number;
};
type BaselineWorkspace = "board" | "studios";
type BoardComparisonSortKey = "customer" | "baseline" | "registered" | "allocated" | "delta" | "peopleDelta" | "breakdown" | "status";
const sourceSpecificStudioBaselineSourceCodes = studioBaselineSources
  .filter((source) => source.code !== "studio_general")
  .map((source) => source.code);

export function BaselineComparison() {
  const { accessUser, canEdit } = useAccess();
  const {
    areas,
    customers,
    customerTargets,
    people,
    boardTargetBaselines,
    studioBaselineSnapshots,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
    targetAllocations,
    saveCustomers,
  } = useDeliveryStore();
  const [workspace, setWorkspace] = useState<BaselineWorkspace>("board");
  const [year, setYear] = useState(defaultTargetYear);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<BaselineComparisonMode>("client");
  const [status, setStatus] = useState("");
  const [boardSortState, setBoardSortState] = useState<SortState<BoardComparisonSortKey>>({ key: "customer", direction: "asc" });
  const [studioSourceCode, setStudioSourceCode] = useState<StudioBaselineSourceCode>("studio_general");
  const [dismissedStudioSnapshotId, setDismissedStudioSnapshotId] = useState("");
  const [studioStatus, setStudioStatus] = useState("");
  const [studioFilter, setStudioFilter] = useState("");
  const [updatingCustomerId, setUpdatingCustomerId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, defaultTargetYear), [customerTargets]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const hunterScope = useMemo(() => buildHunterAccessScope({
    accessUser,
    people,
    customers: yearCustomers,
    targetAllocations,
    studioTargetAllocations,
    specialistHunterStudioAssignments,
  }), [accessUser, people, specialistHunterStudioAssignments, studioTargetAllocations, targetAllocations, yearCustomers]);
  const scopedYearCustomers = useMemo(
    () => hunterScope.enabled
      ? yearCustomers.filter((customer) => hunterScope.customerIds.has(customer.id))
      : yearCustomers,
    [hunterScope, yearCustomers],
  );
  const scopedCustomerNames = useMemo(
    () => new Set(scopedYearCustomers.map((customer) => normalizeBusinessName(customer.name))),
    [scopedYearCustomers],
  );
  const scopedStudioTargetAllocations = useMemo(
    () => hunterScope.enabled
      ? studioTargetAllocations.filter((allocation) => hunterScope.customerIds.has(allocation.customerId))
      : studioTargetAllocations,
    [hunterScope, studioTargetAllocations],
  );
  const scopedTargetAllocations = useMemo(
    () => hunterScope.enabled
      ? targetAllocations.filter((allocation) => hunterScope.customerIds.has(allocation.customerId))
      : targetAllocations,
    [hunterScope, targetAllocations],
  );
  const activeBaselineRows = boardTargetBaselines;
  const scopedBoardBaselineRows = useMemo(
    () => filterBoardBaselineRowsForScope(activeBaselineRows, scopedCustomerNames, hunterScope.enabled),
    [activeBaselineRows, hunterScope.enabled, scopedCustomerNames],
  );
  const registeredTotals = useMemo(() => getRegisteredTargetTotals(scopedYearCustomers), [scopedYearCustomers]);
  const rows = useMemo(() => enrichBoardComparisonRows(
    buildBoardTargetComparisonRows(scopedYearCustomers, year, scopedBoardBaselineRows),
    scopedYearCustomers,
    people,
    scopedTargetAllocations,
    scopedStudioTargetAllocations,
    areas,
    year,
  ), [areas, people, scopedBoardBaselineRows, scopedStudioTargetAllocations, scopedTargetAllocations, scopedYearCustomers, year]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.toLowerCase();
    return (!query || `${row.customerName} ${row.registeredCustomerName}`.toLowerCase().includes(query))
      && (!status || row.status === status)
      && isVisibleForMode(row, mode);
  }), [mode, rows, search, status]);
  const focusedTotals = useMemo(() => getFocusedTotals(filteredRows, mode), [filteredRows, mode]);
  const sortedBoardRows = useMemo(
    () => sortBoardComparisonRows(filteredRows, boardSortState, mode),
    [boardSortState, filteredRows, mode],
  );
  const reportRows = useMemo(() => sortedBoardRows.map((row) => {
    const focused = getFocusedValues(row, mode);
    return {
      customerName: row.customerName,
      registeredCustomerName: row.registeredCustomerName || "Não cadastrado",
      businessUnit: row.businessUnit,
      viewMode: getModeLabel(mode),
      baselineHunterTarget: row.baselineHunterTarget,
      baselineFarmerRenewalTarget: row.baselineFarmerRenewalTarget,
      baselineTotalTarget: row.baselineTotalTarget,
      registeredHunterTarget: row.registeredHunterTarget,
      registeredFarmerRenewalTarget: row.registeredFarmerRenewalTarget,
      registeredStudioMaintenanceTarget: row.registeredStudioMaintenanceTarget,
      registeredTotalTarget: row.registeredTotalTarget,
      allocatedPeopleHunterTarget: row.allocatedPeopleHunterTarget,
      allocatedPeopleFarmerRenewalTarget: row.allocatedPeopleFarmerRenewalTarget,
      allocatedPeopleTotalTarget: row.allocatedPeopleTotalTarget,
      comparedBaseline: focused.baseline,
      comparedRegistered: focused.registered,
      comparedAllocatedPeople: focused.allocatedPeople,
      comparedDelta: focused.delta,
      comparedPeopleDelta: focused.peopleDelta,
      status: getBoardComparisonStatusLabel(row.status),
      year,
    };
  }), [mode, sortedBoardRows, year]);
  const reportColumns = useMemo<ReportColumn<(typeof reportRows)[number]>[]>(() => [
    { key: "customerName", label: "Cliente baseline", value: (row) => row.customerName },
    { key: "registeredCustomerName", label: "Cliente cadastrado", value: (row) => row.registeredCustomerName },
    { key: "businessUnit", label: "BU", value: (row) => row.businessUnit },
    { key: "viewMode", label: "Visão", value: (row) => row.viewMode },
    { key: "baselineHunterTarget", label: "Baseline Hunter", value: (row) => row.baselineHunterTarget, format: "currency", align: "right" },
    { key: "baselineFarmerRenewalTarget", label: "Baseline Renovação", value: (row) => row.baselineFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "baselineTotalTarget", label: "Baseline Total", value: (row) => row.baselineTotalTarget, format: "currency", align: "right" },
    { key: "registeredHunterTarget", label: "Cadastrado Hunter", value: (row) => row.registeredHunterTarget, format: "currency", align: "right" },
    { key: "registeredFarmerRenewalTarget", label: "Cadastrado Renovação", value: (row) => row.registeredFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "registeredStudioMaintenanceTarget", label: "Cadastrado Studio Manutenção", value: (row) => row.registeredStudioMaintenanceTarget, format: "currency", align: "right" },
    { key: "registeredTotalTarget", label: "Cadastrado Total", value: (row) => row.registeredTotalTarget, format: "currency", align: "right" },
    { key: "allocatedPeopleHunterTarget", label: "Pessoas Hunter", value: (row) => row.allocatedPeopleHunterTarget, format: "currency", align: "right" },
    { key: "allocatedPeopleFarmerRenewalTarget", label: "Pessoas Renovação", value: (row) => row.allocatedPeopleFarmerRenewalTarget, format: "currency", align: "right" },
    { key: "allocatedPeopleTotalTarget", label: "Pessoas Total", value: (row) => row.allocatedPeopleTotalTarget, format: "currency", align: "right" },
    { key: "comparedBaseline", label: "Baseline Comparado", value: (row) => row.comparedBaseline, format: "currency", align: "right" },
    { key: "comparedRegistered", label: "Cliente Comparado", value: (row) => row.comparedRegistered, format: "currency", align: "right" },
    { key: "comparedAllocatedPeople", label: "Pessoas Comparado", value: (row) => row.comparedAllocatedPeople, format: "currency", align: "right" },
    { key: "comparedDelta", label: "Diferença Cliente x Baseline", value: (row) => row.comparedDelta, format: "currency", align: "right" },
    { key: "comparedPeopleDelta", label: "Diferença Pessoas x Baseline", value: (row) => row.comparedPeopleDelta, format: "currency", align: "right" },
    { key: "status", label: "Status Cliente", value: (row) => row.status },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);
  const latestStudioSnapshot = useMemo(
    () => studioBaselineSnapshots.find((snapshot) => snapshot.year === year && snapshot.sourceCode === studioSourceCode),
    [studioBaselineSnapshots, studioSourceCode, year],
  );
  const latestCurveStudioSnapshot = useMemo(
    () => studioBaselineSnapshots.find((snapshot) => snapshot.year === year && snapshot.sourceCode === "studio_general"),
    [studioBaselineSnapshots, year],
  );
  const latestSourceSpecificStudioSnapshots = useMemo(
    () => sourceSpecificStudioBaselineSourceCodes
      .map((sourceCode) => studioBaselineSnapshots.find((snapshot) => snapshot.year === year && snapshot.sourceCode === sourceCode))
      .filter((snapshot): snapshot is StudioBaselineSnapshot => Boolean(snapshot)),
    [studioBaselineSnapshots, year],
  );
  const latestCurveStudioSnapshotRows = useMemo(
    () => latestCurveStudioSnapshot
      ? refreshStudioBaselineComparisonsFromCurrentData(
        filterStudioComparisonRowsForScope(restoreStudioBaselineComparisonRows(latestCurveStudioSnapshot.rows), scopedCustomerNames, hunterScope.enabled),
        scopedYearCustomers,
        areas,
        scopedStudioTargetAllocations,
        year,
      )
      : [],
    [areas, hunterScope.enabled, latestCurveStudioSnapshot, scopedCustomerNames, scopedStudioTargetAllocations, scopedYearCustomers, year],
  );
  const latestStudioSnapshotRows = useMemo(() => {
    if (studioSourceCode === "studio_general") {
      const sourceSpecificRows = latestSourceSpecificStudioSnapshots.flatMap((snapshot) => (
        dismissedStudioSnapshotId === snapshot.id
          ? []
          : refreshStudioBaselineComparisonsFromCurrentData(
            filterStudioComparisonRowsForScope(restoreStudioBaselineComparisonRows(snapshot.rows), scopedCustomerNames, hunterScope.enabled),
            scopedYearCustomers,
            areas,
            scopedStudioTargetAllocations,
            year,
          )
      ));
      const fallbackCurveRows = latestStudioSnapshot && dismissedStudioSnapshotId !== latestStudioSnapshot.id
        ? refreshStudioBaselineComparisonsFromCurrentData(
          filterStudioComparisonRowsForScope(restoreStudioBaselineComparisonRows(latestStudioSnapshot.rows), scopedCustomerNames, hunterScope.enabled),
          scopedYearCustomers,
          areas,
          scopedStudioTargetAllocations,
          year,
        )
        : [];
      return applyCurveBaselineToStudioComparisons(
        sourceSpecificRows.length ? sourceSpecificRows : fallbackCurveRows,
        latestCurveStudioSnapshotRows,
      );
    }

    return latestStudioSnapshot && dismissedStudioSnapshotId !== latestStudioSnapshot.id
      ? applyCurveBaselineToStudioComparisons(
        refreshStudioBaselineComparisonsFromCurrentData(
          filterStudioComparisonRowsForScope(restoreStudioBaselineComparisonRows(latestStudioSnapshot.rows), scopedCustomerNames, hunterScope.enabled),
          scopedYearCustomers,
          areas,
          scopedStudioTargetAllocations,
          year,
        ),
        latestCurveStudioSnapshotRows,
      )
      : [];
  },
    [areas, dismissedStudioSnapshotId, hunterScope.enabled, latestCurveStudioSnapshotRows, latestSourceSpecificStudioSnapshots, latestStudioSnapshot, scopedCustomerNames, scopedStudioTargetAllocations, scopedYearCustomers, studioSourceCode, year],
  );
  const isStudioSnapshotLoaded = latestStudioSnapshotRows.length > 0;
  const studioComparisonRows = latestStudioSnapshotRows;
  const activeStudioBaselineFileName = isStudioSnapshotLoaded
    ? studioSourceCode === "studio_general" && latestSourceSpecificStudioSnapshots.length
      ? "Consolidado das últimas fotos por Studio"
      : latestStudioSnapshot?.fileName ?? ""
    : "";
  const activeStudioSnapshotCreatedAt = useMemo(() => {
    if (!isStudioSnapshotLoaded) return "";
    if (studioSourceCode === "studio_general" && latestSourceSpecificStudioSnapshots.length) {
      return latestSourceSpecificStudioSnapshots
        .map((snapshot) => snapshot.createdAt)
        .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] ?? "";
    }
    return latestStudioSnapshot?.createdAt ?? "";
  }, [isStudioSnapshotLoaded, latestSourceSpecificStudioSnapshots, latestStudioSnapshot, studioSourceCode]);
  const studioOptions = useMemo(
    () => Array.from(new Set(studioComparisonRows.map((row) => row.studioName).filter(Boolean))).sort((first, second) => first.localeCompare(second, "pt-BR")),
    [studioComparisonRows],
  );
  const filteredStudioComparisonRows = useMemo(() => studioComparisonRows.filter((row) =>
    (!studioStatus || row.status === studioStatus)
    && (!studioFilter || row.studioName === studioFilter)
  ), [studioComparisonRows, studioFilter, studioStatus]);
  const studioComparisonTotals = useMemo(() => getStudioComparisonTotals(filteredStudioComparisonRows), [filteredStudioComparisonRows]);
  const studioReportRows = useMemo<StudioBaselineReportRow[]>(
    () => filteredStudioComparisonRows.flatMap((row) => buildStudioRowsForReport(row, year)),
    [filteredStudioComparisonRows, year],
  );
  const studioReportColumns = useMemo<ReportColumn<StudioBaselineReportRow>[]>(() => [
    { key: "customerName", label: "Cliente", value: (row) => row.customerName },
    { key: "studioName", label: "Studio", value: (row) => row.studioName },
    { key: "sourceNote", label: "Origem", value: (row) => row.sourceNote },
    { key: "view", label: "Visão", value: (row) => row.view },
    { key: "hunterAmount", label: "Hunter", value: (row) => row.hunterAmount, format: "currency", align: "right" },
    { key: "maintenanceAmount", label: "Manutenção", value: (row) => row.maintenanceAmount, format: "currency", align: "right" },
    { key: "totalAmount", label: "Total", value: (row) => row.totalAmount, format: "currency", align: "right" },
    { key: "difference", label: "Diferença", value: (row) => row.difference, format: "currency", align: "right" },
    { key: "differenceLabel", label: "Referência da diferença", value: (row) => row.differenceLabel },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);

  async function updateCustomerFromBaseline(row: ComparisonRow) {
    if (!canEdit) {
      setErrorMessage("Seu perfil permite consultar o comparativo, mas não atualizar metas de clientes por esta tela.");
      return;
    }

    const customer = findRegisteredCustomer(row, scopedYearCustomers);
    if (!customer) {
      setErrorMessage("Cliente não encontrado no cadastro para atualizar a meta.");
      return;
    }

    const nextCustomer = buildCustomerFromBaseline(customer, row);
    const confirmed = window.confirm(
      [
        `Atualizar a meta do cliente ${customer.name} para os valores do baseline oficial de ${year}?`,
        "",
        `Hunter: ${formatCurrency(nextCustomer.hunterTarget)}`,
        `Renovação + Ampliação: ${formatCurrency(nextCustomer.farmerRenewalTarget)}`,
        `Áreas / Studios: ${formatCurrency(nextCustomer.studioTarget)}`,
        `Meta total: ${formatCurrency(nextCustomer.revenue)}`,
        "",
        "As metas cadastradas nas pessoas serão preservadas.",
      ].join("\n"),
    );
    if (!confirmed) return;

    setUpdatingCustomerId(customer.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await saveCustomers([nextCustomer], year);
      setSuccessMessage(`Meta do cliente ${customer.name} atualizada para o baseline de ${year}. As metas das pessoas foram preservadas.`);
      window.setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      setErrorMessage(getImportErrorMessage(error));
    } finally {
      setUpdatingCustomerId("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Baseline do board"
        title="Comparativo Baseline vs Cadastro"
        description={hunterScope.enabled
          ? "Compare o baseline oficial contra o cadastro operacional apenas dos clientes vinculados ao seu perfil."
          : "Compare o baseline oficial contra o cadastro operacional, incluindo a visão de batimento de Áreas / Studios."}
        actions={(
          workspace === "board" ? (
            <ReportExportActions
              title={`Comparativo Baseline vs Cadastro · ${getModeLabel(mode)} · ${year}`}
              filename={`comparativo-baseline-cadastro-${mode}-${year}`}
              rows={reportRows}
              columns={reportColumns}
            />
          ) : undefined
        )}
      />

      {successMessage && <SuccessNotice message={successMessage} floating />}
      {errorMessage && <ErrorNotice message={errorMessage} floating onClose={() => setErrorMessage("")} />}

      <Card className="mb-5 p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <WorkspaceButton
            active={workspace === "board"}
            title="Board vs Cadastro"
            description="Baseline oficial e atualização por cliente."
            onClick={() => setWorkspace("board")}
          />
          <WorkspaceButton
            active={workspace === "studios"}
            title="Baseline de Studios"
            description="Fotos salvas na central de Baselines e batimento detalhado."
            onClick={() => setWorkspace("studios")}
          />
        </div>
      </Card>

      {workspace === "board" ? (
        <BoardBaselineSection
          year={year}
          years={years}
          search={search}
          mode={mode}
          status={status}
          registeredTotals={registeredTotals}
          focusedTotals={focusedTotals}
          filteredRows={sortedBoardRows}
          sortState={boardSortState}
          updatingCustomerId={updatingCustomerId}
          yearCustomers={scopedYearCustomers}
          canUpdateCustomers={canEdit}
          hunterScopeEnabled={hunterScope.enabled}
          onYearChange={setYear}
          onSearchChange={setSearch}
          onModeChange={setMode}
          onStatusChange={setStatus}
          onSortChange={setBoardSortState}
          onUpdateCustomer={updateCustomerFromBaseline}
        />
      ) : (
        <StudioBaselineSection
          year={year}
          rows={filteredStudioComparisonRows}
          totals={studioComparisonTotals}
          reportRows={studioReportRows}
          reportColumns={studioReportColumns}
          fileName={activeStudioBaselineFileName}
          loadedFromSnapshot={isStudioSnapshotLoaded}
          snapshotCreatedAt={activeStudioSnapshotCreatedAt}
          sourceCode={studioSourceCode}
          status={studioStatus}
          studioFilter={studioFilter}
          studioOptions={studioOptions}
          hunterScopeEnabled={hunterScope.enabled}
          onSourceChange={setStudioSourceCode}
          onStatusChange={setStudioStatus}
          onStudioFilterChange={setStudioFilter}
          onClear={() => {
            if (isStudioSnapshotLoaded && latestStudioSnapshot) setDismissedStudioSnapshotId(latestStudioSnapshot.id);
            setStudioStatus("");
            setStudioFilter("");
          }}
        />
      )}
    </>
  );
}

function WorkspaceButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100",
      )}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="block text-sm font-bold">{title}</span>
      <span className={cn("mt-1 block text-xs", active ? "text-purple-100" : "text-slate-500")}>{description}</span>
    </button>
  );
}

function BoardBaselineSection({
  year,
  years,
  search,
  mode,
  status,
  registeredTotals,
  focusedTotals,
  filteredRows,
  sortState,
  updatingCustomerId,
  yearCustomers,
  canUpdateCustomers,
  hunterScopeEnabled,
  onYearChange,
  onSearchChange,
  onModeChange,
  onStatusChange,
  onSortChange,
  onUpdateCustomer,
}: {
  year: number;
  years: number[];
  search: string;
  mode: BaselineComparisonMode;
  status: string;
  registeredTotals: ReturnType<typeof getRegisteredTargetTotals>;
  focusedTotals: ReturnType<typeof getFocusedTotals>;
  filteredRows: BoardComparisonRow[];
  sortState: SortState<BoardComparisonSortKey>;
  updatingCustomerId: string;
  yearCustomers: Customer[];
  canUpdateCustomers: boolean;
  hunterScopeEnabled: boolean;
  onYearChange: (year: number) => void;
  onSearchChange: (search: string) => void;
  onModeChange: (mode: BaselineComparisonMode) => void;
  onStatusChange: (status: string) => void;
  onSortChange: Dispatch<SetStateAction<SortState<BoardComparisonSortKey>>>;
  onUpdateCustomer: (row: ComparisonRow) => void;
}) {
  return (
    <>
      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiSummaryCard label={`Baseline Board · ${year}`} currencyValue={focusedTotals.baseline} />
        <KpiSummaryCard label="Cadastrado no Cliente" currencyValue={focusedTotals.registered} />
        <KpiSummaryCard label="Alocado em Pessoas" currencyValue={focusedTotals.allocatedPeople} tone="sky" />
        <KpiSummaryCard label="Dif. Cliente x Baseline" currencyValue={focusedTotals.delta} tone={getDeltaTone(focusedTotals.delta)} />
        <KpiSummaryCard label="Dif. Pessoas x Baseline" currencyValue={focusedTotals.peopleDelta} tone={getDeltaTone(focusedTotals.peopleDelta)} />
        <KpiSummaryCard label="Clientes comparados" value={filteredRows.length} />
      </section>

      <Card className="mb-5 border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <FileSearch className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              O baseline vem da foto aprovada do board.
              {hunterScopeEnabled
                ? " Esta consulta está filtrada pelos clientes vinculados ao seu perfil."
                : " Compare contra a meta anual do cliente e escolha na tabela qual cliente deseja atualizar."}
              {!hunterScopeEnabled && " Nenhum cliente é atualizado automaticamente: o botão da linha altera só a meta daquele cliente, não as metas cadastradas nas pessoas."}
              Total cadastrado atual: <span className="font-semibold">{formatCurrency(registeredTotals.totalTarget)}</span>.
              A coluna <span className="font-semibold">Alocado em Pessoas</span> mostra a soma operacional das metas distribuídas nas pessoas, respeitando Studios contidos.
            </p>
          </div>
        </div>
      </Card>

      <FilterBar search={search} onSearchChange={onSearchChange}>
        <Select value={String(year)} onChange={(event) => onYearChange(Number(event.target.value))}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select value={mode} onChange={(event) => onModeChange(event.target.value as BaselineComparisonMode)}>
          <option value="client">Visão por cliente</option>
          <option value="hunter">Visão Hunter</option>
          <option value="combined">Visão Hunter + Farmer</option>
        </Select>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="ok">OK</option>
          <option value="above">Acima do baseline</option>
          <option value="below">Abaixo do baseline</option>
          <option value="missing_customer">Cliente não cadastrado</option>
          <option value="extra_customer">Cliente / receita nova</option>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1680px] table-fixed">
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Cliente" sortKey="customer" sortState={sortState} onSort={onSortChange} className="w-[230px]" />
                <SortableTableHead label="Baseline" sortKey="baseline" sortState={sortState} onSort={onSortChange} className="w-[180px]" />
                <SortableTableHead label="Cadastro do Cliente" sortKey="registered" sortState={sortState} onSort={onSortChange} className="w-[180px]" />
                <SortableTableHead label="Alocado em Pessoas" sortKey="allocated" sortState={sortState} onSort={onSortChange} className="w-[190px]" />
                <SortableTableHead label="Dif. Cliente" sortKey="delta" sortState={sortState} onSort={onSortChange} className="w-[170px]" />
                <SortableTableHead label="Dif. Pessoas" sortKey="peopleDelta" sortState={sortState} onSort={onSortChange} className="w-[180px]" />
                <SortableTableHead label="Breakdown cadastrado" sortKey="breakdown" sortState={sortState} onSort={onSortChange} className="w-[280px]" />
                <SortableTableHead label="Status Cliente" sortKey="status" sortState={sortState} onSort={onSortChange} className="w-[150px]" />
                <TableHead className="w-[220px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const focused = getFocusedValues(row, mode);
                const customer = findRegisteredCustomer(row, yearCustomers);
                const canUpdate = Boolean(canUpdateCustomers && customer && row.status !== "missing_customer" && row.status !== "extra_customer");
                return (
                  <TableRow key={`${row.key}-${mode}`}>
                    <TableCell className="w-[230px]">
                      <p className="font-bold text-slate-950">{row.customerName}</p>
                      <p className="text-xs text-slate-400">{row.registeredCustomerName ? `Cadastro: ${row.registeredCustomerName}` : "Sem cliente cadastrado correspondente"}</p>
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <MoneyStack
                        main={focused.baseline}
                        lines={mode === "client" ? [
                          ["Hunter", row.baselineHunterTarget],
                          ["Renov. + Ampl.", row.baselineFarmerRenewalTarget],
                        ] : []}
                      />
                    </TableCell>
                    <TableCell className="w-[180px]"><MoneyStack main={focused.registered} /></TableCell>
                    <TableCell className="w-[190px]">
                      <MoneyStack
                        main={focused.allocatedPeople}
                        lines={mode === "client" ? [
                          ["Hunter", row.allocatedPeopleHunterTarget],
                          ["Renov. + Ampl.", row.allocatedPeopleFarmerRenewalTarget],
                        ] : []}
                      />
                    </TableCell>
                    <TableCell className="w-[170px]">
                      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-bold tabular-nums", getDeltaClassName(focused.delta))}>
                        {focused.delta > 0.01 ? <ArrowUp className="h-4 w-4" /> : focused.delta < -0.01 ? <ArrowDown className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {formatCurrency(focused.delta)}
                      </span>
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-bold tabular-nums", getDeltaClassName(focused.peopleDelta))}>
                        {focused.peopleDelta > 0.01 ? <ArrowUp className="h-4 w-4" /> : focused.peopleDelta < -0.01 ? <ArrowDown className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {formatCurrency(focused.peopleDelta)}
                      </span>
                    </TableCell>
                    <TableCell className="w-[280px]">
                      <RegisteredBreakdown
                        hunter={row.registeredHunterTarget}
                        farmerRenewal={row.registeredFarmerRenewalTarget}
                        studioMaintenance={row.registeredStudioMaintenanceTarget}
                      />
                    </TableCell>
                    <TableCell className="w-[150px]"><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="w-[220px] text-right">
                      {canUpdateCustomers ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canUpdate || updatingCustomerId === customer?.id}
                          onClick={() => onUpdateCustomer(row)}
                          title="Atualiza somente este cliente com os valores da planilha/baseline, sem alterar metas das pessoas."
                        >
                          {updatingCustomerId === customer?.id && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                          Atualizar este cliente
                        </Button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Consulta</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!filteredRows.length && <EmptyState />}
      </Card>
    </>
  );
}

function StudioBaselineSection({
  year,
  rows,
  totals,
  reportRows,
  reportColumns,
  fileName,
  loadedFromSnapshot,
  snapshotCreatedAt,
  sourceCode,
  status,
  studioFilter,
  studioOptions,
  hunterScopeEnabled,
  onSourceChange,
  onStatusChange,
  onStudioFilterChange,
  onClear,
}: {
  year: number;
  rows: StudioBaselineComparisonRow[];
  totals: ReturnType<typeof getStudioComparisonTotals>;
  reportRows: StudioBaselineReportRow[];
  reportColumns: ReportColumn<StudioBaselineReportRow>[];
  fileName: string;
  loadedFromSnapshot: boolean;
  snapshotCreatedAt: string;
  sourceCode: StudioBaselineSourceCode;
  status: string;
  studioFilter: string;
  studioOptions: string[];
  hunterScopeEnabled: boolean;
  onSourceChange: (sourceCode: StudioBaselineSourceCode) => void;
  onStatusChange: (status: string) => void;
  onStudioFilterChange: (studio: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="space-y-5">
      <Card className="border-purple-100 bg-purple-50/40 p-4 text-sm text-slate-700">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-brq-purple" />
            <div>
              <p className="font-bold text-slate-950">Baseline de Studios</p>
              <p className="mt-1">
                Esta visão lê a última foto salva na central de Baselines para a origem selecionada.
                Linhas Novo/Ampliação viram Studio Hunter; Manutenção/Renovação compara contra a manutenção alocada no cliente e no Studio.
                {hunterScopeEnabled && " A consulta está filtrada pelos clientes vinculados ao seu perfil."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sourceCode} onChange={(event) => onSourceChange(event.target.value as StudioBaselineSourceCode)}>
              {studioBaselineSources.map((source) => <option key={source.code} value={source.code}>{source.name}</option>)}
            </Select>
            {fileName && (
              <Button type="button" variant="outline" onClick={onClear}>
                Limpar baseline
              </Button>
            )}
            {rows.length > 0 && (
              <ReportExportActions
                title={`Batimento Baseline de Studios · ${year}`}
                filename={`batimento-baseline-studios-${year}`}
                rows={reportRows}
                columns={reportColumns}
                renderPreview={(previewRows) => <StudioExportPreview rows={previewRows} />}
              />
            )}
          </div>
        </div>
        {fileName && (
          <p className="mt-3 text-xs text-purple-800">
            {loadedFromSnapshot ? "Última foto salva carregada" : "Arquivo carregado"}: <span className="font-semibold">{fileName}</span>
            {loadedFromSnapshot && snapshotCreatedAt && (
              <span> · salva em {formatDateTime(snapshotCreatedAt)}</span>
            )}
          </p>
        )}
      </Card>

      {rows.length > 0 ? (
        <>
          <Card className="grid gap-3 p-4 shadow-sm md:grid-cols-3">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Status</span>
              <Select value={status} onChange={(event) => onStatusChange(event.target.value)}>
                <option value="">Todos os status</option>
                <option value="ok">OK</option>
                <option value="allocation_gap">Alocação divergente</option>
                <option value="missing_customer">Cliente ausente</option>
                <option value="missing_studio">Studio ausente</option>
              </Select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Studio</span>
              <Select value={studioFilter} onChange={(event) => onStudioFilterChange(event.target.value)}>
                <option value="">Todos os studios</option>
                {studioOptions.map((studio) => <option key={studio} value={studio}>{studio}</option>)}
              </Select>
            </label>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={() => {
                onStatusChange("");
                onStudioFilterChange("");
              }}>
                Limpar filtros
              </Button>
            </div>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiSummaryCard label="Baseline Studios" currencyValue={totals.baselineTotal} tone="purple" />
            <KpiSummaryCard label="Alocado Hunter + Manut." currencyValue={totals.allocatedTotal} tone="sky" />
            <KpiSummaryCard label="Diferença" currencyValue={totals.allocationDelta} tone={getDeltaTone(totals.allocationDelta)} />
            <KpiSummaryCard label="Linhas comparadas" value={rows.length} />
            <KpiSummaryCard label="Divergências" value={rows.filter((row) => row.status !== "ok").length} tone={rows.some((row) => row.status !== "ok") ? "warning" : "ok"} />
          </section>

          <div className="grid gap-4">
            {rows.map((row) => (
              <StudioComparisonCard key={row.key} row={row} year={year} />
            ))}
          </div>
        </>
      ) : (
        <Card className="p-6 text-sm text-slate-500">
          Nenhuma foto salva para esta origem e ano. Importe e salve a baseline na central de Baselines para habilitar o batimento.
        </Card>
      )}
    </section>
  );
}

function StudioComparisonCard({ row, year }: { row: StudioBaselineComparisonRow; year: number }) {
  const reportRows = buildStudioRowsForReport(row, year);
  const sourceNotes = getStudioSourceNotes(row);
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-950">{row.customerName}</p>
            <span className="text-xs font-semibold uppercase text-slate-300">/</span>
            <p className="text-sm font-bold text-slate-700">{row.studioName}</p>
          </div>
          {sourceNotes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {sourceNotes.map((note) => (
                <Badge key={note} className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  {note}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <StudioStatusBadge status={row.status} />
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Visão</TableHead>
              <TableHead className="text-right">Hunter</TableHead>
              <TableHead className="text-right">Manutenção</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Diferença</TableHead>
              <TableHead>Como comparar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportRows.map((item) => (
              <TableRow key={item.key} className={item.view === "Baseline" ? "bg-white" : ""}>
                <TableCell className="font-bold text-slate-900">{item.view}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(item.hunterAmount)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(item.maintenanceAmount)}</TableCell>
                <TableCell className="text-right font-black tabular-nums text-slate-950">{formatCurrency(item.totalAmount)}</TableCell>
                <TableCell className={cn("text-right font-black tabular-nums", getDeltaClassName(item.difference))}>
                  {formatCurrency(item.difference)}
                </TableCell>
                <TableCell className="text-xs leading-relaxed text-slate-500">{item.differenceLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function buildStudioRowsForReport(row: StudioBaselineComparisonRow, year: number): StudioBaselineReportRow[] {
  return buildStudioBaselineReportRows(row, year, {
    sourceNote: getStudioSourceNotes(row).join(" · "),
    allocatedDifferenceLabel: getStudioComparisonReference(row),
    includeDifferenceLabels: true,
  });
}

function getStudioComparisonReference(row: StudioBaselineComparisonRow) {
  if (row.baselineHunter > 0 && row.baselineMaintenance > 0) {
    return "Studio Hunter: compara Novo/Ampliação da planilha com alocações Hunter. Manutenção/Renovação: compara demais tipos da planilha com a manutenção alocada no cliente/studio.";
  }
  if (row.baselineHunter > 0) {
    return "Compara Novo/Ampliação da planilha com Studio Hunter alocado para Hunters/pessoas com papel de Hunter.";
  }
  if (row.baselineMaintenance > 0) {
    return "Compara manutenção/renovação da planilha com o valor de manutenção alocado no cliente e neste Studio.";
  }
  return "Sem valor de referência na planilha para este cliente/studio.";
}

function getStudioSourceNotes(row: StudioBaselineComparisonRow) {
  const notes: string[] = [];
  if (!row.registeredCustomerName) {
    notes.push("Cliente não cadastrado");
  } else if (normalizeBusinessName(row.registeredCustomerName) !== normalizeBusinessName(row.customerName)) {
    notes.push(`Cliente cadastrado: ${row.registeredCustomerName}`);
  }
  if (!row.registeredStudioName) {
    notes.push("Studio não cadastrado");
  } else if (normalizeBusinessName(row.registeredStudioName) !== normalizeBusinessName(row.studioName)) {
    notes.push(`Studio cadastrado: ${row.registeredStudioName}`);
  }
  return notes;
}

function filterBoardBaselineRowsForScope(
  rows: BoardTargetBaselineRow[],
  scopedCustomerNames: Set<string>,
  scoped: boolean,
) {
  if (!scoped) return rows;
  return rows.filter((row) => scopedCustomerNames.has(normalizeBusinessName(row.customerName)));
}

function filterStudioComparisonRowsForScope(
  rows: StudioBaselineComparisonRow[],
  scopedCustomerNames: Set<string>,
  scoped: boolean,
) {
  if (!scoped) return rows;
  return rows.filter((row) => scopedCustomerNames.has(normalizeBusinessName(row.registeredCustomerName || row.customerName)));
}

function MoneyStack({ main, lines = [] }: { main: number; lines?: Array<[string, number]> }) {
  return (
    <div className="min-w-0 space-y-1 tabular-nums">
      <p className="whitespace-nowrap font-bold text-slate-950">{formatCurrency(main)}</p>
      {lines.map(([label, value]) => (
        <p key={label} className="flex min-w-0 items-center justify-between gap-2 text-xs text-slate-400">
          <span className="truncate">{label}:</span>
          <span className="shrink-0 text-slate-500">{formatCurrency(value)}</span>
        </p>
      ))}
    </div>
  );
}

function RegisteredBreakdown({
  hunter,
  farmerRenewal,
  studioMaintenance,
}: {
  hunter: number;
  farmerRenewal: number;
  studioMaintenance: number;
}) {
  const items = [
    ["Hunter", hunter],
    ["Renov.", farmerRenewal],
    ["Studio Manut.", studioMaintenance],
  ] as const;

  return (
    <div className="w-full space-y-1 text-xs tabular-nums text-slate-500">
      {items.map(([label, value]) => (
        <p key={label} className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
          <span className="truncate">{label}:</span>
          <strong className="min-w-0 whitespace-nowrap text-right text-slate-900">{formatCurrency(value)}</strong>
        </p>
      ))}
    </div>
  );
}

function StudioExportPreview({ rows }: { rows: StudioBaselineReportRow[] }) {
  const groups = rows.reduce((accumulator, row) => {
    const key = `${row.customerName}:${row.studioName}`;
    const current = accumulator.get(key) ?? [];
    current.push(row);
    accumulator.set(key, current);
    return accumulator;
  }, new Map<string, StudioBaselineReportRow[]>());

  return (
    <div className="space-y-3">
      {Array.from(groups.entries()).map(([key, groupRows]) => {
        const first = groupRows[0];
        return (
        <article key={key} className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-950">{first.customerName}</p>
              <p className="text-xs text-slate-500">
                Studio: <span className="font-semibold text-slate-700">{first.studioName}</span>
              </p>
              {first.sourceNote && <p className="mt-1 text-xs font-semibold text-amber-700">{first.sourceNote}</p>}
            </div>
            <Badge className={cn(
              "w-fit",
              first.status === "OK" && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
              first.status !== "OK" && "bg-amber-100 text-amber-800 hover:bg-amber-100",
            )}>
              {first.status}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Visão</TableHead>
                  <TableHead className="text-right">Hunter</TableHead>
                  <TableHead className="text-right">Manutenção</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-bold text-slate-900">{row.view}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.hunterAmount)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(row.maintenanceAmount)}</TableCell>
                    <TableCell className="text-right font-black tabular-nums">{formatCurrency(row.totalAmount)}</TableCell>
                    <TableCell className={cn("text-right font-black tabular-nums", getDeltaClassName(row.difference))}>
                      {formatCurrency(row.difference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </article>
      );})}
    </div>
  );
}

function StatusBadge({ status }: { status: ComparisonRow["status"] }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  if (status === "above") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Acima</Badge>;
  if (status === "below") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Abaixo</Badge>;
  if (status === "missing_customer") return <Badge variant="destructive">Cliente ausente</Badge>;
  return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Cliente / receita nova</Badge>;
}

function StudioStatusBadge({ status }: { status: StudioBaselineComparisonRow["status"] }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  if (status === "missing_customer") return <Badge variant="destructive">Cliente ausente</Badge>;
  if (status === "missing_studio") return <Badge variant="destructive">Studio ausente</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Alocação divergente</Badge>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getStudioComparisonTotals(rows: StudioBaselineComparisonRow[]) {
  return rows.reduce((totals, row) => {
    return {
      baselineTotal: totals.baselineTotal + row.baselineTotal,
      allocatedTotal: totals.allocatedTotal + row.allocatedTotal,
      allocationDelta: totals.allocationDelta + row.allocationDelta,
    };
  }, {
    baselineTotal: 0,
    allocatedTotal: 0,
    allocationDelta: 0,
  });
}

function isVisibleForMode(row: BoardComparisonRow, mode: BaselineComparisonMode) {
  if (mode === "hunter") return row.baselineHunterTarget > 0 || row.registeredHunterTarget > 0 || row.allocatedPeopleHunterTarget > 0;
  if (mode === "combined") return row.baselineTotalTarget > 0
    || row.registeredHunterTarget + row.registeredFarmerRenewalTarget > 0
    || row.allocatedPeopleHunterTarget + row.allocatedPeopleFarmerRenewalTarget > 0;
  return true;
}

function getFocusedValues(row: BoardComparisonRow, mode: BaselineComparisonMode) {
  if (mode === "hunter") {
    return {
      baseline: row.baselineHunterTarget,
      registered: row.registeredHunterTarget,
      allocatedPeople: row.allocatedPeopleHunterTarget,
      delta: row.hunterDelta,
      peopleDelta: row.allocatedPeopleHunterTarget - row.baselineHunterTarget,
    };
  }
  if (mode === "combined") {
    const registered = row.registeredHunterTarget + row.registeredFarmerRenewalTarget;
    const allocatedPeople = row.allocatedPeopleHunterTarget + row.allocatedPeopleFarmerRenewalTarget;
    return {
      baseline: row.baselineTotalTarget,
      registered,
      allocatedPeople,
      delta: registered - row.baselineTotalTarget,
      peopleDelta: allocatedPeople - row.baselineTotalTarget,
    };
  }
  return {
    baseline: row.baselineTotalTarget,
    registered: row.registeredTotalTarget,
    allocatedPeople: row.allocatedPeopleTotalTarget,
    delta: row.totalDelta,
    peopleDelta: row.peopleDelta,
  };
}

function getFocusedTotals(rows: BoardComparisonRow[], mode: BaselineComparisonMode) {
  return rows.reduce((totals, row) => {
    const focused = getFocusedValues(row, mode);
    return {
      baseline: totals.baseline + focused.baseline,
      registered: totals.registered + focused.registered,
      allocatedPeople: totals.allocatedPeople + focused.allocatedPeople,
      delta: totals.delta + focused.delta,
      peopleDelta: totals.peopleDelta + focused.peopleDelta,
    };
  }, { baseline: 0, registered: 0, allocatedPeople: 0, delta: 0, peopleDelta: 0 });
}

function sortBoardComparisonRows(
  rows: BoardComparisonRow[],
  sortState: SortState<BoardComparisonSortKey>,
  mode: BaselineComparisonMode,
) {
  if (!sortState) return rows;
  return sortRows(rows, sortState.direction, (first, second) => {
    const firstFocused = getFocusedValues(first, mode);
    const secondFocused = getFocusedValues(second, mode);
    if (sortState.key === "customer") return compareText(first.customerName, second.customerName);
    if (sortState.key === "baseline") return compareNumber(firstFocused.baseline, secondFocused.baseline);
    if (sortState.key === "registered") return compareNumber(firstFocused.registered, secondFocused.registered);
    if (sortState.key === "allocated") return compareNumber(firstFocused.allocatedPeople, secondFocused.allocatedPeople);
    if (sortState.key === "delta") return compareNumber(firstFocused.delta, secondFocused.delta);
    if (sortState.key === "peopleDelta") return compareNumber(firstFocused.peopleDelta, secondFocused.peopleDelta);
    if (sortState.key === "breakdown") return compareNumber(first.registeredStudioMaintenanceTarget, second.registeredStudioMaintenanceTarget);
    return compareText(getBoardComparisonStatusLabel(first.status), getBoardComparisonStatusLabel(second.status));
  });
}

function sortRows<T>(rows: T[], direction: SortDirection, compare: (first: T, second: T) => number) {
  return [...rows].sort((first, second) => (direction === "asc" ? 1 : -1) * compare(first, second));
}

function compareNumber(first: number, second: number) {
  return first - second;
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "pt-BR");
}

function getModeLabel(mode: BaselineComparisonMode) {
  if (mode === "hunter") return "Hunter";
  if (mode === "combined") return "Hunter + Farmer";
  return "Cliente";
}

function getDeltaTone(value: number) {
  if (value > 0.01) return "ok";
  if (value < -0.01) return "danger";
  return "ok";
}

function getDeltaClassName(value: number) {
  if (value > 0.01) return "text-emerald-700";
  if (value < -0.01) return "text-red-700";
  return "text-emerald-700";
}

function findRegisteredCustomer(row: ComparisonRow, customers: Customer[]) {
  if (row.registeredCustomerName) {
    const registeredName = normalizeBusinessName(row.registeredCustomerName);
    const byRegisteredName = customers.find((customer) => normalizeBusinessName(customer.name) === registeredName);
    if (byRegisteredName) return byRegisteredName;
  }
  const baselineName = normalizeBusinessName(row.customerName);
  return customers.find((customer) => normalizeBusinessName(customer.name) === baselineName);
}

function enrichBoardComparisonRows(
  rows: ComparisonRow[],
  customers: Customer[],
  people: Parameters<typeof getCustomerAllocationComposition>[1],
  allocations: Parameters<typeof getCustomerAllocationComposition>[2],
  studioAllocations: Parameters<typeof getCustomerAllocationComposition>[3],
  areas: Parameters<typeof getCustomerAllocationComposition>[4],
  year: number,
): BoardComparisonRow[] {
  return rows.map((row) => {
    const customer = findRegisteredCustomer(row, customers);
    if (!customer) {
      return {
        ...row,
        allocatedPeopleHunterTarget: 0,
        allocatedPeopleFarmerRenewalTarget: 0,
        allocatedPeopleTotalTarget: 0,
        peopleDelta: -row.baselineTotalTarget,
      };
    }

    const composition = getCustomerAllocationComposition(
      customer,
      people,
      allocations,
      studioAllocations,
      areas,
      year,
      getCustomerTargetBreakdown(customer),
    );

    return {
      ...row,
      allocatedPeopleHunterTarget: composition.allocatedHunter,
      allocatedPeopleFarmerRenewalTarget: composition.allocatedFarmerRenewal,
      allocatedPeopleTotalTarget: composition.allocatedTotal,
      peopleDelta: composition.allocatedTotal - row.baselineTotalTarget,
    };
  });
}

function buildCustomerFromBaseline(customer: Customer, row: ComparisonRow): Customer {
  const studioTarget = Math.max(row.baselineTotalTarget - row.baselineHunterTarget - row.baselineFarmerRenewalTarget, 0);
  return {
    ...customer,
    hunterTarget: row.baselineHunterTarget,
    farmerRenewalTarget: row.baselineFarmerRenewalTarget,
    studioTarget,
    revenue: getCustomerTotalTargetFromParts(row.baselineHunterTarget, row.baselineFarmerRenewalTarget),
  };
}

function getImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível importar ou aplicar a planilha. Verifique o formato e tente novamente.";
}
