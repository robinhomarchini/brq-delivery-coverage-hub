"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, FileSearch, RefreshCw } from "lucide-react";
import type { Customer } from "@/data/mockData";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { KpiSummaryCard } from "@/components/shared/kpi-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { ReportExportActions, type ReportColumn } from "@/components/shared/report-export-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorNotice, SuccessNotice } from "@/components/shared/success-notice";
import { useDeliveryStore } from "@/store/delivery-store";
import { getCustomerTotalTargetFromParts } from "@/lib/customer-target-total";
import { applyCustomerTargetsForYear, defaultTargetYear, getAvailableTargetYears } from "@/lib/customer-targets";
import {
  buildBoardTargetComparisonRows,
  getBoardComparisonStatusLabel,
  getBoardTargetBaselineTotals,
  getRegisteredTargetTotals,
  type BaselineComparisonMode,
} from "@/lib/board-target-baseline";
import {
  studioBaselineSources,
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
type BaselineWorkspace = "board" | "studios";

export function BaselineComparison() {
  const { customers, customerTargets, boardTargetBaselines, studioBaselineSnapshots, saveCustomers } = useDeliveryStore();
  const [workspace, setWorkspace] = useState<BaselineWorkspace>("board");
  const [year, setYear] = useState(defaultTargetYear);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<BaselineComparisonMode>("client");
  const [status, setStatus] = useState("");
  const [studioSourceCode, setStudioSourceCode] = useState<StudioBaselineSourceCode>("studio_general");
  const [dismissedStudioSnapshotId, setDismissedStudioSnapshotId] = useState("");
  const [studioStatus, setStudioStatus] = useState("");
  const [studioFilter, setStudioFilter] = useState("");
  const [updatingCustomerId, setUpdatingCustomerId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const years = useMemo(() => getAvailableTargetYears(customerTargets, defaultTargetYear), [customerTargets]);
  const yearCustomers = useMemo(() => applyCustomerTargetsForYear(customers, customerTargets, year), [customerTargets, customers, year]);
  const activeBaselineRows = boardTargetBaselines;
  const baselineTotals = useMemo(() => getBoardTargetBaselineTotals(year, activeBaselineRows), [activeBaselineRows, year]);
  const registeredTotals = useMemo(() => getRegisteredTargetTotals(yearCustomers), [yearCustomers]);
  const rows = useMemo(() => buildBoardTargetComparisonRows(yearCustomers, year, activeBaselineRows), [activeBaselineRows, year, yearCustomers]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = search.toLowerCase();
    return (!query || `${row.customerName} ${row.registeredCustomerName}`.toLowerCase().includes(query))
      && (!status || row.status === status)
      && isVisibleForMode(row, mode);
  }), [mode, rows, search, status]);
  const focusedTotals = useMemo(() => getFocusedTotals(filteredRows, mode), [filteredRows, mode]);
  const reportRows = useMemo(() => filteredRows.map((row) => {
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
      comparedBaseline: focused.baseline,
      comparedRegistered: focused.registered,
      comparedDelta: focused.delta,
      status: getBoardComparisonStatusLabel(row.status),
      year,
    };
  }), [filteredRows, mode, year]);
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
    { key: "comparedBaseline", label: "Baseline Comparado", value: (row) => row.comparedBaseline, format: "currency", align: "right" },
    { key: "comparedRegistered", label: "Cadastrado Comparado", value: (row) => row.comparedRegistered, format: "currency", align: "right" },
    { key: "comparedDelta", label: "Diferença Comparada", value: (row) => row.comparedDelta, format: "currency", align: "right" },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "year", label: "Ano", value: (row) => row.year, format: "number", align: "center" },
  ], []);
  const latestStudioSnapshot = useMemo(
    () => studioBaselineSnapshots.find((snapshot) => snapshot.year === year && snapshot.sourceCode === studioSourceCode),
    [studioBaselineSnapshots, studioSourceCode, year],
  );
  const latestStudioSnapshotRows = useMemo(
    () => latestStudioSnapshot && dismissedStudioSnapshotId !== latestStudioSnapshot.id
      ? restoreStudioBaselineComparisonRows(latestStudioSnapshot.rows)
      : [],
    [dismissedStudioSnapshotId, latestStudioSnapshot],
  );
  const isStudioSnapshotLoaded = latestStudioSnapshotRows.length > 0;
  const studioComparisonRows = latestStudioSnapshotRows;
  const activeStudioBaselineFileName = isStudioSnapshotLoaded ? latestStudioSnapshot?.fileName ?? "" : "";
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
    const customer = findRegisteredCustomer(row, yearCustomers);
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
        description="Compare o baseline oficial contra o cadastro operacional, incluindo a visão de batimento de Áreas / Studios."
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
          baselineTotals={baselineTotals}
          registeredTotals={registeredTotals}
          focusedTotals={focusedTotals}
          filteredRows={filteredRows}
          updatingCustomerId={updatingCustomerId}
          yearCustomers={yearCustomers}
          onYearChange={setYear}
          onSearchChange={setSearch}
          onModeChange={setMode}
          onStatusChange={setStatus}
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
          snapshotCreatedAt={isStudioSnapshotLoaded ? latestStudioSnapshot?.createdAt ?? "" : ""}
          sourceCode={studioSourceCode}
          status={studioStatus}
          studioFilter={studioFilter}
          studioOptions={studioOptions}
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
  baselineTotals,
  registeredTotals,
  focusedTotals,
  filteredRows,
  updatingCustomerId,
  yearCustomers,
  onYearChange,
  onSearchChange,
  onModeChange,
  onStatusChange,
  onUpdateCustomer,
}: {
  year: number;
  years: number[];
  search: string;
  mode: BaselineComparisonMode;
  status: string;
  baselineTotals: ReturnType<typeof getBoardTargetBaselineTotals>;
  registeredTotals: ReturnType<typeof getRegisteredTargetTotals>;
  focusedTotals: ReturnType<typeof getFocusedTotals>;
  filteredRows: ComparisonRow[];
  updatingCustomerId: string;
  yearCustomers: Customer[];
  onYearChange: (year: number) => void;
  onSearchChange: (search: string) => void;
  onModeChange: (mode: BaselineComparisonMode) => void;
  onStatusChange: (status: string) => void;
  onUpdateCustomer: (row: ComparisonRow) => void;
}) {
  return (
    <>
      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiSummaryCard label={`Baseline Board · ${year}`} currencyValue={focusedTotals.baseline} />
        <KpiSummaryCard label="Cadastrado" currencyValue={focusedTotals.registered} />
        <KpiSummaryCard label="Diferença" currencyValue={focusedTotals.delta} tone={getDeltaTone(focusedTotals.delta)} />
        <KpiSummaryCard label="Clientes comparados" value={filteredRows.length} />
        <KpiSummaryCard label="Total Board 2026" currencyValue={baselineTotals.totalTarget} />
      </section>

      <Card className="mb-5 border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <FileSearch className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              O baseline vem da foto aprovada do board.
              Compare contra a meta anual do cliente e escolha na tabela qual cliente deseja atualizar.
              Nenhum cliente é atualizado automaticamente: o botão da linha altera só a meta daquele cliente, não as metas cadastradas nas pessoas.
              Total cadastrado atual: <span className="font-semibold">{formatCurrency(registeredTotals.totalTarget)}</span>.
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
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Cadastrado</TableHead>
                <TableHead>Diferença</TableHead>
                <TableHead>Breakdown cadastrado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const focused = getFocusedValues(row, mode);
                const customer = findRegisteredCustomer(row, yearCustomers);
                const canUpdate = Boolean(customer && row.status !== "missing_customer" && row.status !== "extra_customer");
                return (
                  <TableRow key={`${row.key}-${mode}`}>
                    <TableCell>
                      <p className="font-bold text-slate-950">{row.customerName}</p>
                      <p className="text-xs text-slate-400">{row.registeredCustomerName ? `Cadastro: ${row.registeredCustomerName}` : "Sem cliente cadastrado correspondente"}</p>
                    </TableCell>
                    <TableCell>
                      <MoneyStack
                        main={focused.baseline}
                        lines={mode === "client" ? [
                          ["Hunter", row.baselineHunterTarget],
                          ["Renov. + Ampl.", row.baselineFarmerRenewalTarget],
                        ] : []}
                      />
                    </TableCell>
                    <TableCell><MoneyStack main={focused.registered} /></TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1 font-bold", getDeltaClassName(focused.delta))}>
                        {focused.delta > 0.01 ? <ArrowUp className="h-4 w-4" /> : focused.delta < -0.01 ? <ArrowDown className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {formatCurrency(focused.delta)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="grid max-w-md gap-1 text-xs text-slate-500 md:grid-cols-3">
                        <span>Hunter: <strong className="text-slate-900">{formatCurrency(row.registeredHunterTarget)}</strong></span>
                        <span>Renov.: <strong className="text-slate-900">{formatCurrency(row.registeredFarmerRenewalTarget)}</strong></span>
                        <span>Studio Manut.: <strong className="text-slate-900">{formatCurrency(row.registeredStudioMaintenanceTarget)}</strong></span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-right">
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

function MoneyStack({ main, lines = [] }: { main: number; lines?: Array<[string, number]> }) {
  return (
    <div className="space-y-1">
      <p className="font-bold text-slate-950">{formatCurrency(main)}</p>
      {lines.map(([label, value]) => (
        <p key={label} className="text-xs text-slate-400">{label}: {formatCurrency(value)}</p>
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

function isVisibleForMode(row: ComparisonRow, mode: BaselineComparisonMode) {
  if (mode === "hunter") return row.baselineHunterTarget > 0 || row.registeredHunterTarget > 0;
  if (mode === "combined") return row.baselineTotalTarget > 0 || row.registeredHunterTarget + row.registeredFarmerRenewalTarget > 0;
  return true;
}

function getFocusedValues(row: ComparisonRow, mode: BaselineComparisonMode) {
  if (mode === "hunter") {
    return {
      baseline: row.baselineHunterTarget,
      registered: row.registeredHunterTarget,
      delta: row.hunterDelta,
    };
  }
  if (mode === "combined") {
    const registered = row.registeredHunterTarget + row.registeredFarmerRenewalTarget;
    return {
      baseline: row.baselineTotalTarget,
      registered,
      delta: registered - row.baselineTotalTarget,
    };
  }
  return {
    baseline: row.baselineTotalTarget,
    registered: row.registeredTotalTarget,
    delta: row.totalDelta,
  };
}

function getFocusedTotals(rows: ComparisonRow[], mode: BaselineComparisonMode) {
  return rows.reduce((totals, row) => {
    const focused = getFocusedValues(row, mode);
    return {
      baseline: totals.baseline + focused.baseline,
      registered: totals.registered + focused.registered,
      delta: totals.delta + focused.delta,
    };
  }, { baseline: 0, registered: 0, delta: 0 });
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
